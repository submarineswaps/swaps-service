const asyncAuto = require('async/auto');
const {createAddress} = require('ln-service');
const {createInvoice} = require('ln-service');
const {getRoutes} = require('ln-service');
const {payInvoice} = require('ln-service');

const {addressDetails} = require('./../chain');
const {broadcastTransaction} = require('./../chain');
const {checkInvoicePayable} = require('./../swaps');
const {claimTransaction} = require('./../swaps');
const getFeeForSwap = require('./get_fee_for_swap');
const {getFeeRate} = require('./../blocks');
const {getRecentChainTip} = require('./../blocks');
const {getRecentFeeRate} = require('./../blocks');
const {parseInvoice} = require('./../lightning');
const {lightningDaemon} = require('./../lightning');
const {returnResult} = require('./../async-util');
const {setJsonInCache} = require('./../cache');
const swapParameters = require('./swap_parameters');
const {swapScriptInTransaction} = require('./../swaps');

const dummyLockingInvoiceValue = 1;
const dummyPreimage = '0000000000000000000000000000000000000000000000000000000000000000';
const estimatedTxVirtualSize = 200;
const paymentTimeoutMs = 1000 * 60;
const swapSuccessCacheMs = 1000 * 60 * 60;

/** Complete a swap transaction

  When the swap has already been completed

  {
    cache: <Cache Type String>
    invoice: <Bolt 11 Invoice String>
    key: <Private Key WIF String>
    network: <Network Name String>
    script: <Redeem Script Hex String>
    transaction: <Funding Transaction Hex String>
  }

  @returns via cbk
  {
    funding_utxos: [{
      redeem: <Redeem Script Hex String>
      script: <ScriptPub Hex String>
      tokens: <Tokens Number>
      transaction_id: <Transaction Id Hex String>
      vout: <Vout Number>
    }]
    invoice_id: <Invoice Id Hex String>
    payment_secret: <Payment Secret Hex String>
    transaction_id: <Transaction Id Hex String>
  }
*/
module.exports = ({cache, invoice, key, network, script, transaction}, cbk) => {
  return asyncAuto({
    // Check completion arguments
    validate: cbk => {
      if (!cache) {
        return cbk([400, 'ExpectedCacheToStoreSwapSuccess']);
      }

      if (!invoice) {
        return cbk([400, 'ExpectedInvoice']);
      }

      if (!key) {
        return cbk([400, 'ExpectedPrivateKey']);
      }

      if (!network) {
        return cbk([400, 'ExpectedNetwork']);
      }

      if (!script) {
        return cbk([400, 'ExpectedRedeemScript']);
      }

      if (!transaction) {
        return cbk([400, 'ExpectedFundingTransaction']);
      }

      return cbk();
    },

    // Funding UTXOs from the transaction
    fundingUtxos: ['validate', ({}, cbk) => {
      try {
        return cbk(null, swapScriptInTransaction({
          transaction,
          redeem_script: script,
        }));
      } catch (err) {
        return cbk([500, e.message, err]);
      }
    }],

    // Check the current state of the blockchain to get a good locktime
    getChainTip: ['validate', ({}, cbk) => {
      return getRecentChainTip({network}, cbk);
    }],

    // Figure out what fee is needed to sweep the funds
    getFeeRate: ['validate', ({}, cbk) => {
      return getRecentFeeRate({cache, network}, cbk);
    }],

    // Decode the supplied invoice
    parsedInvoice: ['validate', ({}, cbk) => {
      try {
        return cbk(null, parseInvoice({invoice}));
      } catch (err) {
        return cbk([400, 'DecodeInvoiceFailure', err]);
      }
    }],

    // Figure out what it will cost to do this swap
    getSwapFee: ['parsedInvoice', ({parsedInvoice}, cbk) => {
      const to = parsedInvoice.network;
      const {tokens} = parsedInvoice;

      return getFeeForSwap({cache, network, to, tokens}, cbk);
    }],

    // Initialize the LN daemon connection
    lnd: ['parsedInvoice', ({parsedInvoice}, cbk) => {
      try {
        return cbk(null, lightningDaemon({network: parsedInvoice.network}));
      } catch (err) {
        return cbk([500, 'FailedToInitLightningDaemonConnection', err]);
      }
    }],

    // Hack around the locking failure of paying invoices twice
    createLockingInvoice: [
      'fundingUtxos',
      'getChainTip',
      'getFeeRate',
      'lnd',
      'parsedInvoice',
      ({parsedInvoice, lnd}, cbk) =>
    {
      const {id} = parsedInvoice;

      return createInvoice({
        lnd,
        expires_at: new Date(Date.now() + paymentTimeoutMs).toISOString(),
        payment_secret: id,
        tokens: dummyLockingInvoiceValue,
      },
      cbk);
    }],

    // Make a new address to sweep out the funds to
    getSweepAddress: ['createLockingInvoice', 'lnd', ({lnd}, cbk) => {
      const net = network.toUpperCase();

      const address = process.env[`SSS_CLAIM_${net}_ADDRESS`];

      if (!!address) {
        return cbk(null, {address});
      }

      return createAddress({lnd}, cbk);
    }],

    // Make sure that the sweep address is OK
    checkSweepAddress: ['getSweepAddress', ({getSweepAddress}, cbk) => {
      const {address} = getSweepAddress;

      try {
        const {type} = addressDetails({address, network});

        switch (type) {
        case 'p2wpkh':
        case 'p2wsh':
        case 'p2pkh':
        case 'p2sh':
          return cbk();

        default:
          return cbk([500, 'UnknownClaimAddressType', address, type]);
        }
      } catch (err) {
        return cbk([500, 'InvalidClaimAddress', address]);
      }
    }],

    // Do a sanity check to see if the invoice can be claimed
    canClaim: [
      'checkSweepAddress',
      'fundingUtxos',
      'getChainTip',
      'getFeeRate',
      'getSweepAddress',
      ({fundingUtxos, getChainTip, getFeeRate, getSweepAddress}, cbk) =>
    {
      try {
        return cbk(null, claimTransaction({
          network,
          current_block_height: getChainTip.height,
          destination: getSweepAddress.address,
          fee_tokens_per_vbyte: getFeeRate.fee_tokens_per_vbyte,
          preimage: dummyPreimage,
          private_key: key,
          utxos: fundingUtxos.matching_outputs,
        }));
      } catch (err) {
        return cbk([500, 'ExpectedDummyClaimTransaction', err]);
      }
    }],

    // Pay the invoice
    payInvoice: [
      'canClaim',
      'createLockingInvoice',
      'getSwapFee',
      'lnd',
      ({getSwapFee, lnd}, cbk) =>
    {
      return payInvoice({invoice, lnd, fee: getSwapFee.fee}, cbk);
    }],

    // Create a claim transaction to sweep the swap to the destination address
    claimTransaction: [
      'fundingUtxos',
      'getChainTip',
      'getFeeRate',
      'getSweepAddress',
      'payInvoice',
      ({
        fundingUtxos,
        getChainTip,
        getFeeRate,
        getSweepAddress,
        payInvoice,
      },
      cbk) =>
    {
      try {
        return cbk(null, claimTransaction({
          network,
          current_block_height: getChainTip.height,
          destination: getSweepAddress.address,
          fee_tokens_per_vbyte: getFeeRate.fee_tokens_per_vbyte,
          preimage: payInvoice.payment_secret,
          private_key: key,
          utxos: fundingUtxos.matching_outputs,
        }));
      } catch (err) {
        return cbk([500, 'ExpectedClaimTransaction', err]);
      }
    }],

    // Broadcast the claim transaction
    broadcastTransaction: ['claimTransaction', ({claimTransaction}, cbk) => {
      return broadcastTransaction({
        network,
        priority: 0,
        transaction: claimTransaction.transaction
      },
      cbk);
    }],

    // Return the details of the completed swap
    completedSwap: [
      'broadcastTransaction',
      'fundingUtxos',
      'parsedInvoice',
      'payInvoice',
      ({
        broadcastTransaction,
        fundingUtxos,
        parsedInvoice,
        payInvoice,
      },
      cbk) =>
    {
      return cbk(null, {
        invoice_id: parsedInvoice.id,
        funding_utxos: fundingUtxos.matching_outputs,
        payment_secret: payInvoice.payment_secret,
        transaction_id: broadcastTransaction.id,
      });
    }],
  },
  returnResult({of: 'completedSwap'}, cbk));
};

