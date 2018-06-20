const asyncAuto = require('async/auto');

const getBlockHeader = require('./get_block_header');
const getCurrentHash = require('./get_current_hash');
const {returnResult} = require('./../async-util');

const staleBlockMs = 1000 * 60 * 60 * 6;

/** Confirm that a chain backend is connected

  {
    network: <Network Name String>
  }
*/
module.exports = ({network}, cbk) => {
  return asyncAuto({
    // Check arguments
    validate: cbk => {
      if (!network) {
        return cbk([400, 'ExpectedNetworkForChainConfirmation']);
      }

      return cbk();
    },

    // Get the chain tip
    getChainTipHash: ['validate', ({}, cbk) => getCurrentHash({network}, cbk)],

    // Get header info
    getHeaderInfo: ['getChainTipHash', ({getChainTipHash}, cbk) => {
      const block = getChainTipHash.current_hash;

      if (!block) {
        return cbk([503, 'ExpectedCurrentChainTipBlockHash']);
      }

      return getBlockHeader({block, network}, cbk);
    }],

    // Check header info
    checkHeaderInfo: ['getHeaderInfo', ({getHeaderInfo}, cbk) => {
      const delayMs = Date.now() - Date.parse(getHeaderInfo.median_created_at);

      if (delayMs > staleBlockMs) {
        return cbk([503, 'StaleRemoteBlockTime', delayMs]);
      }

      return cbk();
    }],
  },
  returnResult({}, cbk));
};

