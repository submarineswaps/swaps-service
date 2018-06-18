const asyncAuto = require('async/auto');

const chainRpc = require('./call_chain_rpc');
const {getBlockHeader} = require('./conf/rpc_commands');
const {getJsonFromCache} = require('./../cache');
const {returnResult} = require('./../async-util');
const {setJsonInCache} = require('./../cache');

const previousBlockCacheMs = 1000 * 60 * 60 * 24;

/** Get block header details for a given block

  {
    block: <Block Hash Id String>
    [cache]: <Cache Name String> // When set, current conf count is omitted
    network: <Network Name String>
  }

  @returns via cbk
  {
    [current_confirmation_count]: <Current Confirmation Count Number>
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
      const type = 'previous_block';

      return getJsonFromCache({cache, key, type}, cbk);
    }],

    // Pull the fresh block header details
    getFresh: ['getCached', ({getCached}, cbk) => {
      if (!!getCached && !!getCached.previous_block) {
        return cbk();
      }

      return chainRpc({
        cmd: getBlockHeader,
        network: network,
        params: [block],
      },
      (err, details) => {
        if (!!err) {
          return cbk(err);
        }

        const confs = details.confirmations > 0 ? details.confirmations : null;

        return cbk(null, {
          current_confirmation_count: confs,
          previous_block: details.previousblockhash,
        });
      });
    }],

    // Set cache
    setCache: ['getFresh', ({getFresh}, cbk) => {
      if (!cache || !getFresh) {
        return cbk();
      }

      return setJsonInCache({
        cache,
        key: block,
        ms: previousBlockCacheMs,
        type: 'previous_block',
        value: {previous_block: getFresh.previous_block},
      },
      cbk);
    }],

    // Previous hash
    blockHeader: ['getCached', 'getFresh', ({getCached, getFresh}, cbk) => {
      const block = getFresh || getCached;

      return cbk(null, {
        current_confirmation_count: block.current_confirmation_count || null,
        previous_block: block.previous_block,
      });
    }],
  },
  returnResult({of: 'blockHeader'}, cbk));
};

