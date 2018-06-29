const asyncAuto = require('async/auto');

const {getChainFeeRate} = require('./../chain');
const {getJsonFromCache} = require('./../cache');
const {returnResult} = require('./../async-util');
const {setJsonInCache} = require('./../cache');

const cacheResultMs = 1000 * 60;

/** Get recent fee rate value

  {
    cache: <Cache Type String>
    network: <Network Name String>
  }

  @returns via cbk
  {
    fee_tokens_per_vbyte: <Fee Tokens per Vbyte Number>
  }
*/
module.exports = ({cache, network}, cbk) => {
  return asyncAuto({
    // Check arguments
    validate: cbk => {
      if (!cache) {
        return cbk([400, 'ExpectedCacheForFeeRateCheck']);
      }

      if (!network) {
        return cbk([400, 'ExpectedNetworkForFeeRate']);
      }

      return cbk();
    },

    // Get the cached result
    getCached: ['validate', ({}, cbk) => {
      return getJsonFromCache({cache, key: network, type: 'fee_rate'}, cbk);
    }],

    // Get a fresh result
    getFresh: ['getCached', ({getCached}, cbk) => {
      if (!!getCached && !!getCached.fee_tokens_per_vbyte) {
        return cbk();
      }

      return getChainFeeRate({network}, cbk);
    }],

    // Set the fresh result into the cache
    setCached: ['getCached', 'getFresh', ({getCached, getFresh}, cbk) => {
      // Exit early when we already have a cached value
      if (!!getCached && !!getCached.fee_tokens_per_vbyte) {
        return cbk()
      }

      return setJsonInCache({
        cache,
        key: network,
        ms: cacheResultMs,
        type: 'fee_rate',
        value: {fee_tokens_per_vbyte: getFresh.fee_tokens_per_vbyte},
      },
      cbk);
    }],

    // Final result
    result: ['getCached', 'getFresh', ({getCached, getFresh}, cbk) => {
      const result = getFresh || getCached;

      return cbk(null, {fee_tokens_per_vbyte: result.fee_tokens_per_vbyte});
    }],
  },
  returnResult({of: 'result'}, cbk));
};

