const asyncAuto = require('async/auto');

const {getBlockHeader} = require('./../chain');
const {getJsonFromCache} = require('./../cache');
const {returnResult} = require('./../async-util');
const {setJsonInCache} = require('./../cache');

const cache = 'memory';
const cacheHeightMs = 1000 * 60 * 60;
const type = 'get_height_for_block';

/** Get the height of a block

  {
    block: <Block Id Hex String>
    network: <Network Name String>
    [priority]: <Priority Number>
  }

  @returns via cbk
  {
    [height]: <Block Height Number>
  }
*/
module.exports = ({block, network, priority}, cbk) => {
  return asyncAuto({
    // Check arguments
    validate: cbk => {
      if (!block) {
        return cbk([400, 'ExpectedBlockIdToGetHeightFor']);
      }

      if (!network) {
        return cbk([400, 'ExpectedNetworkForBlockHeightLookup']);
      }

      return cbk();
    },

    // Key for cache
    key: ['validate', ({}, cbk) => cbk(null, [network, block].join())],

    // Get the cached result
    getCached: ['key', ({key}, cbk) => {
      return getJsonFromCache({cache, key, type}, cbk);
    }],

    // Get the fresh value as necessary
    getFresh: ['getCached', ({getCached}, cbk) => {
      // Exit early when cached value is available
      if (!!getCached && !!getCached.height) {
        return cbk();
      }

      return getBlockHeader({block, network, priority}, cbk);
    }],

    // Set the cached value
    setCached: [
      'getCached',
      'getFresh',
      'key',
      ({getCached, getFresh, key}, cbk) =>
    {
      // Exit when the value originates from the cache
      if (!!getCached && getCached.height !== undefined) {
        return cbk();
      }

      return setJsonInCache({
        cache,
        key,
        type,
        ms: cacheHeightMs,
        value: {height: getFresh.height},
      },
      cbk);
    }],

    // Height for the block
    height: ['getCached', 'getFresh', ({getCached, getFresh}, cbk) => {
      if (!!getFresh && getFresh.height !== undefined) {
        return cbk(null, {height: getFresh.height});
      }

      if (!!getCached && getCached.height !== undefined) {
        return cbk(null, {height: getCached.height});
      }

      return cbk(null, {});
    }],
  },
  returnResult({of: 'height'}, cbk));
};

