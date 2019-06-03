const asyncAuto = require('async/auto');
const {returnResult} = require('asyncjs-util');

const {getBlockHeader} = require('./../chain');
const {getCurrentHash} = require('./../chain');
const getHeightForBlock = require('./get_height_for_block');
const {getJsonFromCache} = require('./../cache');
const {setJsonInCache} = require('./../cache');

const cache = 'memory';
const cacheChainTipMs = 1000 * 10;
const type = 'get_recent_chain_tip';

/** Get recent-ish chain tip values

  {
    network: <Network Name String>
    [priority]: <Priority Number>
  }

  @returns via cbk
  {
    hash: <Block Hash Hex String>
    height: <Block Height Number>
  }
*/
module.exports = ({network, priority}, cbk) => {
  return asyncAuto({
    // Check arguments
    validate: cbk => {
      if (!network) {
        return cbk([400, 'ExpectedNetworkToFindChainTip']);
      }

      return cbk();
    },

    // Get the cached chain tip hash
    getCached: ['validate', ({}, cbk) => {
      return getJsonFromCache({cache, type, key: network}, cbk);
    }],

    // Get the fresh chain tip hash value as necessary
    getFresh: ['getCached', ({getCached}, cbk) => {
      if (!!getCached && !!getCached.hash) {
        return cbk();
      }

      return getCurrentHash({network, priority}, cbk);
    }],

    // Set the cached chain tip value
    setCached: ['getCached', 'getFresh', ({getCached, getFresh}, cbk) => {
      if (!!getCached || !getFresh.hash) {
        return cbk();
      }

      return setJsonInCache({
        cache,
        type,
        key: network,
        ms: cacheChainTipMs,
        value: {hash: getFresh.hash},
      },
      cbk);
    }],

    // Best block hash
    hash: ['getCached', 'getFresh', ({getCached, getFresh}, cbk) => {
      const {hash} = getCached || getFresh;

      return cbk(null, hash);
    }],

    // Get height for hash
    getHeightForBlock: ['hash', ({hash}, cbk) => {
      return getHeightForBlock({network, priority, block: hash}, cbk);
    }],

    // Final chain tip result
    chainTip: [
      'getHeightForBlock',
      'hash',
      ({getHeightForBlock, hash}, cbk) =>
    {
      return cbk(null, {hash, height: getHeightForBlock.height});
    }],
  },
  returnResult({of: 'chainTip'}, cbk));
};

