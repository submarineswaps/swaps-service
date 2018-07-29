const asyncAuto = require('async/auto');
const {createAddress} = require('ln-service');
const {createInvoice} = require('ln-service');
const {getRoutes} = require('ln-service');
const {parseInvoice} = require('ln-service');
const {payInvoice} = require('ln-service');

const addDetectedSwap = require('./../pool/add_detected_swap');
const {broadcastTransaction} = require('./../chain');
const {claimTransaction} = require('./../swaps');
const {getFee} = require('./../chain');
const {getRecentChainTip} = require('./../blocks');
const {getRecentFeeRate} = require('./../blocks');
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
    payment_secret: <Payment Secret Hex String>
    transaction_id: <Transaction Id Hex String>
  }
*/
module.exports = (args, cbk) => {
  return asyncAuto({
    // Check the current state of the blockchain to get a good locktime
    getChainTip: cbk => {
      return getRecentChainTip({
        cache: args.cache,
        network: args.network
      },
      cbk);
    },

    // Figure out what fee is needed to sweep the funds
    getFee: cbk => {
      return getRecentFeeRate({cache: args.cache, network: args.network}, cbk);
    },

    // Parse the given invoice
    invoice: cbk => {
      try {
        return cbk(null, parseInvoice({invoice: args.invoice}));
      } catch (e) {
        return cbk([400, 'DecodeInvoiceFailure', e]);
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

    // Do a sanity check to see if the invoice can be claimed
    canClaim: [
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
      } catch (e) {
        return cbk([500, 'ExpectedClaimTransaction', e]);
      }
    }],

    // Broadcast the claim transaction
    broadcastTransaction: ['claimTransaction', ({claimTransaction}, cbk) => {
      const {transaction} = claimTransaction;

      return broadcastTransaction({transaction, network: args.network}, cbk);
    }],

    // Add the swap to the pool
    addSwap: [
      'broadcastTransaction',
      'fundingUtxos',
      'invoice',
      'payInvoice',
      ({broadcastTransaction, fundingUtxos, invoice, payInvoice}, cbk) =>
    {
      if (fundingUtxos.matching_outputs.length !== 1) {
        return cbk();
      }

      const [utxo] = fundingUtxos.matching_outputs;

      return addDetectedSwap({
        cache: args.cache,
        claim: {
          id: broadcastTransaction.id,
          invoice: args.invoice,
          network: args.network,
          outpoint: `${utxo.transaction_id}:${utxo.vout}`,
          preimage: payInvoice.payment_secret,
          script: args.redeem_script,
        },
        id: invoice.id,
      },
      cbk);
    }],

    // Return the details of the completed swap
    completedSwap: ['broadcastTransaction', 'payInvoice', (res, cbk) => {
      return cbk(null, {
        invoice_id: res.invoice.id,
        payment_secret: res.payInvoice.payment_secret,
        transaction_id: res.broadcastTransaction.id,
      });
    }],
  },
  returnResult({of: 'completedSwap'}, cbk));
};

