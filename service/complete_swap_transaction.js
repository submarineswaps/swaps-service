const asyncAuto = require('async/auto');
const {createAddress} = require('ln-service');
const {createInvoice} = require('ln-service');
const {getRoutes} = require('ln-service');
const {payInvoice} = require('ln-service');

const {addressDetails} = require('./../chain');
const {broadcastTransaction} = require('./../chain');
const {claimTransaction} = require('./../swaps');
const {getFee} = require('./../chain');
const {getRecentChainTip} = require('./../blocks');
const {getRecentFeeRate} = require('./../blocks');
const {parseInvoice} = require('./../lightning');
const {lightningDaemon} = require('./../lightning');
const {returnResult} = require('./../async-util');
const {setJsonInCache} = require('./../cache');
const {swapScriptInTransaction} = require('./../swaps');

const dummyLockingInvoiceValue = 1;
const dummyPreimage = '0000000000000000000000000000000000000000000000000000000000000000';
const paymentTimeoutMs = 1000 * 60;
const swapSuccessCacheMs = 1000 * 60 * 60;

/** Complete a swap transaction

  When the swap has already been completed

  {
    cache: <Cache Type String>
    invoice: <Bolt 11 Invoice String>
    network: <Network Name String>
    private_key: <Private Key WIF String>
    redeem_script: <Redeem Script Hex String>
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
module.exports = (args, cbk) => {
  return asyncAuto({
    // Check the current state of the blockchain to get a good locktime
    getChainTip: cbk => getRecentChainTip({network: args.network}, cbk),

    // Figure out what fee is needed to sweep the funds
    getFee: cbk => {
      return getRecentFeeRate({cache: args.cache, network: args.network}, cbk);
    },

    // Parse the given invoice
    invoice: cbk => {
      try {
        return cbk(null, parseInvoice({invoice: args.invoice}));
      } catch (err) {
        return cbk([400, 'DecodeInvoiceFailure', err]);
      }
    },

    // Check completion arguments
    validate: cbk => {
      if (!args.cache) {
        return cbk([400, 'ExpectedCacheToStoreSwapSuccess']);
      }

      if (!args.invoice) {
        return cbk([400, 'ExpectedInvoice']);
      }

      if (!args.network) {
        return cbk([400, 'ExpectedNetwork']);
      }

      if (!args.private_key) {
        return cbk([400, 'ExpectedPrivateKey']);
      }

      if (!args.redeem_script) {
        return cbk([400, 'ExpectedRedeemScript']);
      }

      if (!args.transaction) {
        return cbk([400, 'ExpectedFundingTransaction']);
      }

      return cbk();
    },

    // Initialize the LN daemon connection
    lnd: ['invoice', ({invoice}, cbk) => {
      try {
        return cbk(null, lightningDaemon({network: invoice.network}));
      } catch (e) {
        return cbk([500, 'FailedToInitLightningDaemonConnection']);
      }
    }],

    // Funding UTXOs from the transaction
    fundingUtxos: ['validate', ({}, cbk) => {
      try {
        return cbk(null, swapScriptInTransaction({
          redeem_script: args.redeem_script,
          transaction: args.transaction,
        }));
      } catch (err) {
        return cbk([0, e.message, err]);
      }
    }],

    // See if this invoice is payable
    getRoutes: ['invoice', 'lnd', ({invoice, lnd}, cbk) => {
      const {destination} = invoice;
      const {tokens} = invoice;

      return getRoutes({destination, lnd, tokens}, cbk);
    }],

    checkRoutes: ['getRoutes', ({getRoutes}, cbk) => {
      if (!getRoutes.routes.length) {
        return cbk([503, 'InsufficientCapacity']);
      }

      return cbk();
    }],

    // Hack around the locking failure of paying invoices twice
    createLockingInvoice: [
      'fundingUtxos',
      'getChainTip',
      'getFee',
      'invoice',
      'lnd',
      ({invoice, lnd}, cbk) =>
    {
      const {id} = invoice;

      return createInvoice({
        lnd,
        expires_at: new Date(Date.now() + paymentTimeoutMs).toISOString(),
        payment_secret: id,
        tokens: dummyLockingInvoiceValue,
      },
      cbk);
    }],

    // Make a new address to sweep out the funds to
    getSweepAddress: [
      'checkRoutes',
      'createLockingInvoice',
      'lnd',
      ({lnd}, cbk) =>
    {
      const net = args.network;

      const address = process.env[`SSS_CLAIM_${net.toUpperCase()}_ADDRESS`];

      if (!!address) {
        return cbk(null, {address});
      }

      return createAddress({lnd}, cbk);
    }],

    // Make sure that the sweep address is OK
    checkSweepAddress: ['getSweepAddress', ({getSweepAddress}, cbk) => {
      const {address} = getSweepAddress;

      try {
        const {type} = addressDetails({address, network: args.network});

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
      'getFee',
      'getSweepAddress',
      ({fundingUtxos, getChainTip, getFee, getSweepAddress}, cbk) =>
    {
      try {
        return cbk(null, claimTransaction({
          current_block_height: getChainTip.height,
          destination: getSweepAddress.address,
          fee_tokens_per_vbyte: getFee.fee_tokens_per_vbyte,
          network: args.network,
          preimage: dummyPreimage,
          private_key: args.private_key,
          utxos: fundingUtxos.matching_outputs,
        }));
      } catch (err) {
        return cbk([500, 'ExpectedDummyClaimTransaction', err]);
      }
    }],

    // Pay the invoice
    payInvoice: ['canClaim', 'createLockingInvoice', 'lnd', ({lnd}, cbk) => {
      return payInvoice({lnd, invoice: args.invoice}, cbk);
    }],

    // Create a claim transaction to sweep the swap to the destination address
    claimTransaction: [
      'fundingUtxos',
      'getChainTip',
      'getFee',
      'getSweepAddress',
      'payInvoice',
      (res, cbk) =>
    {
      try {
        return cbk(null, claimTransaction({
          current_block_height: res.getChainTip.height,
          destination: res.getSweepAddress.address,
          fee_tokens_per_vbyte: res.getFee.fee_tokens_per_vbyte,
          network: args.network,
          preimage: res.payInvoice.payment_secret,
          private_key: args.private_key,
          utxos: res.fundingUtxos.matching_outputs,
        }));
      } catch (err) {
        return cbk([500, 'ExpectedClaimTransaction', err]);
      }
    }],

    // Broadcast the claim transaction
    broadcastTransaction: ['claimTransaction', ({claimTransaction}, cbk) => {
      return broadcastTransaction({
        network: args.network,
        priority: 0,
        transaction: claimTransaction.transaction
      },
      cbk);
    }],

    // Return the details of the completed swap
    completedSwap: [
      'broadcastTransaction',
      'fundingUtxos',
      'invoice',
      'payInvoice',
      ({broadcastTransaction, fundingUtxos, invoice, payInvoice}, cbk) =>
    {
      return cbk(null, {
        invoice_id: invoice.id,
        funding_utxos: fundingUtxos.matching_outputs,
        payment_secret: payInvoice.payment_secret,
        transaction_id: broadcastTransaction.id,
      });
    }],
  },
  returnResult({of: 'completedSwap'}, cbk));
};

