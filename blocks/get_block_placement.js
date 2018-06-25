const asyncAuto = require('async/auto');

const {getBlockHeader} = require('./../chain');
const {getJsonFromCache} = require('./../cache');
const getRecentChainTip = require('./get_recent_chain_tip');
const {returnResult} = require('./../async-util');
const {setJsonInCache} = require('./../cache');

const previousBlockCacheMs = 1000 * 60 * 60 * 4;

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

      if (!cache) {
        return cbk([400, 'ExpectedCacheForPlacementDetection']);
      }

      if (!network) {
        return cbk([400, 'ExpectedNetworkName']);
      }

      return cbk();
    },

    // Figure what the current chain tip is, placement is relative to the tip
    getChainTip: ['validate', ({}, cbk) => {
      return getRecentChainTip({cache, network}, cbk);
    }],

    // See if the previous block hash value is cached
    getCached: ['getChainTip', ({getChainTip}, cbk) => {
      const key = [getChainTip.hash, block].join('/');
      const type = 'block_placement';

      return getJsonFromCache({cache, key, type}, cbk);
    }],

    // Pull the fresh block details
    getFresh: ['getCached', ({getCached}, cbk) => {
      // Exit early when cache contains the confirmation info
      if (!!getCached && !!getCached.previous_block && !!getCached.current_confirmation_count) {
        return cbk();
      }

      return getBlockHeader({block, network}, cbk);
    }],

    // Set placement data into the cache
    setCache: ['getChainTip', 'getFresh', ({getChainTip, getFresh}, cbk) => {
      if (!getFresh) {
        return cbk();
      }

      return setJsonInCache({
        cache,
        key: [getChainTip.hash, block].join('/'),
        ms: previousBlockCacheMs,
        type: 'block_placement',
        value: {
          current_confirmation_count: getFresh.current_confirmation_count,
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
        current_confirmation_count: block.current_confirmation_count,
        median_created_at: block.median_created_at,
        previous_block: block.previous_block,
      });
    }],
  },
  returnResult({of: 'blockPlacement'}, cbk));
};

