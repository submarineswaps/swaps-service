const asyncAuto = require('async/auto');
const {returnResult} = require('asyncjs-util');

const {getBlockHeader} = require('./../chain');
const {getJsonFromCache} = require('./../cache');
const getRecentChainTip = require('./get_recent_chain_tip');
const {networks} = require('./../tokenslib');
const {setJsonInCache} = require('./../cache');

const blockCacheMultiplier = 10;
const type = 'get_block_placement';

/** Get the placement of a block within the chain

  {
    block: <Block Hash Id String>
    [cache]: <Cache Name String> // When set, current conf count is omitted
    network: <Network Name String>
    [priority]: <Priority Number>
  }

  @returns via cbk
  {
    [created_at]: <Time Created At ISO 8601 String>
    [current_confirmation_count]: <Current Confirmation Count Number>
    [previous_block]: <Previous Block Hash Hex String>
  }
*/
module.exports = ({block, cache, network, priority}, cbk) => {
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
      return getRecentChainTip({network, priority}, cbk);
    }],

    // See if the previous block hash value is cached
    getCached: ['getChainTip', ({getChainTip}, cbk) => {
      const key = [getChainTip.hash, block].join('/');

      return getJsonFromCache({cache, key, type}, cbk);
    }],

    // Pull the fresh block details
    getFresh: ['getCached', ({getCached}, cbk) => {
      const hasPrevBlock = !!getCached && !!getCached.previous_block;
      const hasConfCount = !!getCached && !!getCached.confirmation_count;

      // Exit early when cache contains the confirmation info
      if (!!hasPrevBlock && hasConfCount) {
        return cbk();
      }

      return getBlockHeader({block, network, priority}, cbk);
    }],

    // Set placement data into the cache
    setCache: ['getChainTip', 'getFresh', ({getChainTip, getFresh}, cbk) => {
      if (!getFresh) {
        return cbk();
      }

      return setJsonInCache({
        cache,
        type,
        key: [getChainTip.hash, block].join('/'),
        ms: networks[network].ms_per_block * blockCacheMultiplier,
        value: {
          created_at: getFresh.created_at,
          current_confirmation_count: getFresh.current_confirmation_count,
          previous_block: getFresh.previous_block,
        },
      },
      cbk);
    }],

    // Final block placement info
    blockPlacement: ['getCached', 'getFresh', ({getCached, getFresh}, cbk) => {
      const block = getFresh || getCached;

      return cbk(null, {
        created_at: block.created_at,
        current_confirmation_count: block.current_confirmation_count,
        previous_block: block.previous_block,
      });
    }],
  },
  returnResult({of: 'blockPlacement'}, cbk));
};

