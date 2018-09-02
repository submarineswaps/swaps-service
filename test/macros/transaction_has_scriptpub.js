const asyncAuto = require('async/auto');

const {getJsonFromCache} = require('./../../cache');
const {getTransaction} = require('./../../chain');
const {returnResult} = require('./../../async-util');
const {setJsonInCache} = require('./../../cache');
const {Transaction} = require('./../../tokenslib');

const cacheTxMs = 5 * 60 * 1000;
const notFoundIndex = -1;

/** Determine if a transaction has a script pub output

  {
    [block]: <Block Hash Hex String>
    cache: <Cache Type String>
    is_ignoring_tokens: <Is Ignoring Tokens Value Bool>
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
      if (!args.cache) {
        return cbk([400, 'ExpectedCacheTypeToCheckCachedResult']);
      }

      if (!args.network) {
        return cbk([400, 'ExpectedNetwork']);
      }

      if (!Array.isArray(args.output_scripts) || !args.output_scripts.length) {
        return cbk([400, 'ExpectedOutputScripts']);
      }

      if (!args.tokens && !args.is_ignoring_tokens) {
        return cbk([400, 'ExpectedTokens']);
      }

      if (!args.transaction_id) {
        return cbk([400, 'ExpectedTransactionId']);
      }

      return cbk();
    },

    // See if we have a cached result to this query
    getCachedTransaction: ['validate', ({}, cbk) => {
      return getJsonFromCache({
        cache: 'memory',
        key: args.transaction_id,
        type: 'transaction',
      },
      cbk);
    }],

    // Get the transaction
    getTransaction: ['getCachedTransaction', ({getCachedTransaction}, cbk) => {
      if (!!getCachedTransaction && !!getCachedTransaction.transaction) {
        return cbk(null, {
          is_cached_result: true,
          transaction: getCachedTransaction.transaction,
        });
      }

      return getTransaction({
        block: args.block,
        id: args.transaction_id,
        network: args.network,
      },
      cbk);
    }],

    // Set the cached transaction
    setCachedTransaction: ['getTransaction', ({getTransaction}, cbk) => {
      if (!getTransaction || !getTransaction.transaction) {
        return cbk([500, 'ExpectedKnownTransaction']);
      }

      // Exit early when there is no need to cache a fresh result
      if (!!getTransaction.is_cached_result) {
        return cbk();
      }

      return setJsonInCache({
        cache: 'memory',
        key: args.transaction_id,
        ms: cacheTxMs,
        type: 'transaction',
        value: getTransaction.transaction,
      },
      cbk);
    }],

    // Parse the transaction hex
    transaction: ['getTransaction', ({getTransaction}, cbk) => {
      if (!getTransaction || !getTransaction.transaction) {
        return cbk([500, 'ExpectedKnownTransaction']);
      }

      try {
        return cbk(null, Transaction.fromHex(getTransaction.transaction));
      } catch (e) {
        return cbk([503, 'ExpectedValidTransactionHex']);
      }
    }],

    // Determine if the transaction has a script pub
    hasScriptPub: ['transaction', ({transaction}, cbk) => {
      const hasScriptPub = transaction.outs
        .filter(({value}) => !args.is_ignoring_tokens && value === args.tokens)
        .map(({script}) => script.toString('hex'))
        .find(script => args.output_scripts.indexOf(script) !== notFoundIndex);

      return cbk(null, !!hasScriptPub);
    }],
  },
  returnResult({of: 'hasScriptPub'}, cbk));
};

