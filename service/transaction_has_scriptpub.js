const asyncAuto = require('async/auto');
const {Transaction} = require('bitcoinjs-lib');

const {getTransaction} = require('./../chain');
const {returnResult} = require('./../async-util');

const cachedTx = {};
const cacheTxMs = 60 * 60 * 1000;

/** Determine if a transaction has a script pub output

  {
    output_scripts: [<Output Script Hex String>]
    network: <Network Name String>
    tokens: <Tokens Paid Number>
    transaction_id: <Transaction Id String>
  }

  @returns via cbk
  <Transaction Contains Output With Scriptpub Bool>
*/
module.exports = (args, cbk) => {
  return asyncAuto({
    // Check arguments
    validate: cbk => {
      if (!Array.isArray(args.output_scripts) || !args.output_scripts.length) {
        return cbk([400, 'ExpectedOutputScripts']);
      }

      if (!args.network) {
        return cbk([400, 'ExpectedNetwork']);
      }

      if (!args.tokens) {
        return cbk([400, 'ExpectedTokens']);
      }

      if (!args.transaction_id) {
        return cbk([400, 'ExpectedTransactionId']);
      }

      return cbk();
    },

    // Get the transaction
    getTransaction: ['validate', ({}, cbk) => {
      const transaction = cachedTx[args.transaction_id];

      if (!!transaction) {
        return cbk(null, {transaction, is_cached_result: true});
      }

      return getTransaction({
        network: args.network,
        transaction_id: args.transaction_id,
      },
      cbk);
    }],

    // Parse the transaction hex
    transaction: ['getTransaction', ({getTransaction}, cbk) => {
      if (!getTransaction.is_cached_result) {
        cachedTx[args.transaction_id] = getTransaction.transaction;

        setTimeout(() => cachedTx[args.transaction_id] = null, cacheTxMs);
      }

      try {
        return cbk(null, Transaction.fromHex(getTransaction.transaction));
      } catch (e) {
        return cbk([503, 'ExpectedValidTransactionHex']);
      }
    }],

    // Determine if the transaction has a script pub
    hasScriptPub: ['transaction', ({transaction}, cbk) => {
      const scriptPubs = args.output_scripts;

      const hasScriptPub = transaction.outs
        .map(n => ({script: n.script.toString('hex'), tokens: n.value}))
        .find(({script, tokens}) => {
          return scriptPubs.find(n => script === n) && tokens === args.tokens;
        });

      return cbk(null, !!hasScriptPub);
    }],
  },
  returnResult({of: 'hasScriptPub'}, cbk));
};

