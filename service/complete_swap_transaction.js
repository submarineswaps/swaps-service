const asyncAuto = require('async/auto');
const {createAddress} = require('ln-service');
const {createInvoice} = require('ln-service');
const {getRoutes} = require('ln-service');
const {parseInvoice} = require('ln-service');
const {payInvoice} = require('ln-service');

const {broadcastTransaction} = require('./../chain');
const {claimTransaction} = require('./../swaps');
const {getBlockchainInfo} = require('./../chain');
const {getChainFeeRate} = require('./../chain');
const {getFee} = require('./../chain');
const {lightningDaemon} = require('./../lightning');
const {returnResult} = require('./../async-util');
const {swapScriptInTransaction} = require('./../swaps');

/** Complete a swap transaction

  {
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
    getBlockchainInfo: cbk => getBlockchainInfo({network: args.network}, cbk),

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

    // Make a new address to sweep out the funds to
    getSweepAddress: ['checkRoutes', 'lnd', ({lnd}, cbk) => {
      return createAddress({lnd}, cbk);
    }],

    // Hack around the locking failure of paying invoices twice
    createLockingInvoice: [
      'fundingUtxos',
      'getBlockchainInfo',
      'getFee',
      'getSweepAddress',
      'invoice',
      'lnd',
      ({invoice, lnd}, cbk) =>
    {
      const {id} = invoice;

      return createInvoice({lnd, payment_secret: id, tokens: 1}, cbk);
    }],

    // Pay the invoice
    payInvoice: ['createLockingInvoice', 'lnd', ({lnd}, cbk) => {
      return payInvoice({lnd, invoice: args.invoice}, cbk);
    }],

    // Create a claim transaction to sweep the swap to the destination address
    claimTransaction: [
      'fundingUtxos',
      'getBlockchainInfo',
      'getFee',
      'getSweepAddress',
      'payInvoice',
      (res, cbk) =>
    {
      try {
        return cbk(null, claimTransaction({
          current_block_height: res.getBlockchainInfo.current_height,
          destination: res.getSweepAddress.address,
          fee_tokens_per_vbyte: res.getFee.fee_tokens_per_vbyte,
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
    completedSwap: ['broadcastTransaction', (res, cbk) => {
      return cbk(null, {
        payment_secret: res.payInvoice.payment_secret,
        transaction_id: res.broadcastTransaction.transaction_id,
      });
    }],
  },
  returnResult({of: 'completedSwap'}, cbk));
};

