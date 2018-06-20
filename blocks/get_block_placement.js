const asyncAuto = require('async/auto');

const {getBlockHeader} = require('./../chain');
const {getJsonFromCache} = require('./../cache');
const {returnResult} = require('./../async-util');
const {setJsonInCache} = require('./../cache');

const previousBlockCacheMs = 1000 * 60 * 60 * 24;

/** Get the placement of a block within the chain

  {
    block: <Block Hash Id String>
    [cache]: <Cache Name String> // When set, current conf count is omitted
    network: <Network Name String>
  }

  @returns via cbk
  {
    [current_confirmation_count]: <Current Confirmation Count Number>
    [median_created_at]: <Median Time Created At ISO 8601 String>
    [previous_block]: <Previous Block Hash Hex String>
  }
*/
module.exports = ({block, cache, network}, cbk) => {
  return asyncAuto({
    // Check arguments
    validate: cbk => {
      if (!block) {
        return cbk([400, 'ExpectedBlockId'])
      }

      if (!network) {
        return cbk([400, 'ExpectedNetworkName']);
      }

      return cbk();
    },

    // See if the previous block hash value is cached
    getCached: ['validate', ({}, cbk) => {
      if (!cache) {
        return cbk();
      }

      const key = block;
      const type = 'block_placement';

      return getJsonFromCache({cache, key, type}, cbk);
    }],

    // Pull the fresh block details
    getFresh: ['getCached', ({getCached}, cbk) => {
      if (!!getCached && !!getCached.previous_block) {
        return cbk();
      }

      return getBlockHeader({block, network}, cbk);
    }],

    // Set placement data into the cache
    setCache: ['getFresh', ({getFresh}, cbk) => {
      if (!cache || !getFresh) {
        return cbk();
      }

      return setJsonInCache({
        cache,
        key: block,
        ms: previousBlockCacheMs,
        type: 'block_placement',
        value: {
          median_created_at: getFresh.median_created_at,
          previous_block: getFresh.previous_block,
        },
      },
      cbk);
    }],

    // Final block placement info
    blockPlacement: ['getCached', 'getFresh', ({getCached, getFresh}, cbk) => {
      const block = getFresh || getCached;

      return cbk(null, {
        current_confirmation_count: block.current_confirmation_count || null,
        median_created_at: block.median_created_at,
        previous_block: block.previous_block,
      });
    }],
  },
  returnResult({of: 'blockPlacement'}, cbk));
};

