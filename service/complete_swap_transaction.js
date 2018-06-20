const asyncAuto = require('async/auto');
const {createAddress} = require('ln-service');
const {createInvoice} = require('ln-service');
const {getRoutes} = require('ln-service');
const {parseInvoice} = require('ln-service');
const {payInvoice} = require('ln-service');

const {broadcastTransaction} = require('./../chain');
const {claimTransaction} = require('./../swaps');
const {getChainFeeRate} = require('./../chain');
const {getFee} = require('./../chain');
const {getRecentChainTip} = require('./../blocks');
const {lightningDaemon} = require('./../lightning');
const {returnResult} = require('./../async-util');
const {setJsonInCache} = require('./../cache');
const {swapScriptInTransaction} = require('./../swaps');

const {SSS_CLAIM_LTCTESTNET_ADDRESS} = process.env;
const {SSS_CLAIM_TESTNET_ADDRESS} = process.env;
const swapSuccessCacheMs = 1000 * 60 * 60 * 3;

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
    getFee: cbk => getChainFeeRate({network: args.network}, cbk),

    // Parse the given invoice
    invoice: cbk => {
      try {
        return cbk(null, parseInvoice({invoice: args.invoice}));
      } catch (e) {
        return cbk([400, 'DecodeInvoiceFailure', e]);
      }
    },

    // Initialize the LN daemon connection
    lnd: cbk => {
      try {
        return cbk(null, lightningDaemon({}));
      } catch (e) {
        return cbk([500, 'FailedToInitLightningDaemonConnection']);
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

    // Funding UTXOs from the transaction
    fundingUtxos: ['validate', ({}, cbk) => {
      try {
        return cbk(null, swapScriptInTransaction({
          redeem_script: args.redeem_script,
          transaction: args.transaction,
        }));
      } catch (e) {
        return cbk([0, e.message, e]);
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

      return createInvoice({lnd, payment_secret: id, tokens: 1}, cbk);
    }],

    // Make a new address to sweep out the funds to
    getSweepAddress: [
      'checkRoutes',
      'createLockingInvoice',
      'lnd',
      ({lnd}, cbk) =>
    {
      switch (args.network) {
      case 'ltctestnet':
        return cbk(null, {address: SSS_CLAIM_LTCTESTNET_ADDRESS});

      case 'testnet':
        if (!!SSS_CLAIM_TESTNET_ADDRESS) {
          return cbk(null, {address: SSS_CLAIM_TESTNET_ADDRESS});
        }

        return createAddress({lnd}, cbk);

      default:
        return cbk([500, 'UnexpectedNetworkToSweepOutTo', args.network]);
      }
    }],

    // Pay the invoice
    payInvoice: ['createLockingInvoice', 'lnd', ({lnd}, cbk) => {
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

