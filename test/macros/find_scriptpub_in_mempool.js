const asyncAuto = require('async/auto');
const asyncDetectLimit = require('async/detectLimit');
const {returnResult} = require('asyncjs-util');

const {getMempool} = require('./../../chain');
const transactionHasScriptPub = require('./transaction_has_scriptpub');

const cacheMs = 5000;
const checkFanOutLimit = 5;

let cachedMempool = {};

/** Scan the mempool to find a transaction that matches script-pubs

  {
    [is_ignoring_tokens]: <Is Ignoring Tokens Value Bool>
    network: <Network Name String>
    output_scripts: [<Output Script Hex String>]
    [tokens]: <Output Tokens Number>
  }

  @returns via cbk
  {
    [transaction_id]: <Transaction Id Hex String>
  }
*/
module.exports = (args, cbk) => {
  return asyncAuto({
    // Pull all the transaction ids from the mempool
    getMempool: cbk => {
      // Exit early when the cache date is still newer than the cache timeout
      if (new Date() < cachedMempool.clear_cache_date) {
        return cbk(null, {
          is_cached_result: true,
          transaction_ids: cachedMempool.transaction_ids,
        });
      }

      return getMempool({network: args.network}, cbk);
    },

    // Check arguments
    validate: cbk => {
      if (!args.cache) {
        return cbk([400, 'ExpectedCacheForFoundScriptPubs']);
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

      return cbk();
    },

    // Set mempool cache
    setMempoolCache: ['getMempool', ({getMempool}, cbk) => {
      if (!!getMempool.is_cached_result) {
        return cbk();
      }

      cachedMempool.clear_cache_date = new Date(Date.now() + cacheMs);
      cachedMempool.transaction_ids = getMempool.transaction_ids;

      return cbk();
    }],

    // Run through transaction ids and see if they have a matching output
    findTransaction: ['getMempool', ({getMempool}, cbk) => {
      return asyncDetectLimit(
        getMempool.transaction_ids,
        checkFanOutLimit,
        (id, cbk) => transactionHasScriptPub({
          cache: args.cache,
          is_ignoring_tokens: args.is_ignoring_tokens,
          network: args.network,
          output_scripts: args.output_scripts,
          tokens: args.tokens,
          transaction_id: id,
        },
        cbk),
        cbk
      );
    }],

    // The result of the search
    found: ['findTransaction', ({findTransaction}, cbk) => {
      return cbk(null, {transaction_id: findTransaction});
    }],
  },
  returnResult({of: 'found'}, cbk));
};

