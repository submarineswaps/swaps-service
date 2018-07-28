const asyncAuto = require('async/auto');

const {getJsonFromCache} = require('./../cache');
const {getTransaction} = require('./../chain');
const {returnResult} = require('./../async-util');
const {setJsonInCache} = require('./../cache');

const cacheResultMs = 1000 * 60 * 60;

/** Get a raw transaction, with a cached result

  {
    id: <Transaction Id String>
    network: <Network Name String>
  }

  @returns via cbk
  {
    [transaction]: <Transaction Hex String>
  }
*/
module.exports = ({cache, id, network}, cbk) => {
  return asyncAuto({
    // Check arguments
    validate: cbk => {
      if (!cache) {
        return cbk([400, 'ExpectedCacheForTransactionLookup']);
      }

      if (!id) {
        return cbk([400, 'ExpectedIdForTransaction']);
      }

      if (!network) {
        return cbk([400, 'ExpectedNetworkToLookForTransaction']);
      }

      return cbk();
    },

    // Get the cached result
    getCached: ['validate', ({}, cbk) => {
      return getJsonFromCache({cache, key: id, type: 'tx'}, cbk);
    }],

    // Get a fresh result
    getFresh: ['getCached', ({getCached}, cbk) => {
      console.log('GET TX', getCached);

      if (!!getCached && !!getCached.transaction) {
        return cbk();
      }

      return getTransaction({id, network}, cbk);
    }],

    // Set the fresh result into the cache
    setCached: ['getCached', 'getFresh', ({getCached, getFresh}, cbk) => {
      // Exit early when we already have a cached value
      if (!!getCached && !!getCached.transaction) {
        return cbk()
      }

      return setJsonInCache({
        cache,
        key: network,
        ms: cacheResultMs,
        type: 'fee_rate',
        value: {transaction: getFresh.transaction},
      },
      cbk);
    }],

    // Final result
    result: ['getCached', 'getFresh', ({getCached, getFresh}, cbk) => {
      const {transaction} = getFresh || getCached;

      return cbk(null, {transaction});
    }],
  },
  returnResult({of: 'result'}, cbk));
};

