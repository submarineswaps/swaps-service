const asyncAuto = require('async/auto');
const asyncDetectLimit = require('async/detectLimit');

const {getMempool} = require('./../chain');
const {returnResult} = require('./../async-util');
const transactionHasScriptPub = require('./transaction_has_scriptpub');

const cacheMs = 5000;
const checkFanOutLimit = 10;

let cachedMempool = {};

/** Scan the mempool to find a transaction that matches script-pubs

  {
    network: <Network Name String>
    output_scripts: [<Output Script Hex String>]
    tokens: <Output Tokens Number>
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

