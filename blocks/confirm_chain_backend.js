const asyncAuto = require('async/auto');

const {getBlockHeader} = require('./../chain');
const {getCurrentHash} = require('./../chain');
const {networks} = require('./../tokenslib');
const {returnResult} = require('./../async-util');

const staleBlockVariance = 30;

/** Confirm that a chain backend is connected

  If the median time of the chain exceeds a stale block timer, or there is no
  chain tip, the chain backend confirmation will fail with an error.

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
      const block = getChainTipHash.hash;

      if (!block) {
        return cbk([503, 'ExpectedCurrentChainTipBlockHash']);
      }

      return getBlockHeader({block, network}, cbk);
    }],

    // Check header info
    checkHeaderInfo: ['getHeaderInfo', ({getHeaderInfo}, cbk) => {
      if (!getHeaderInfo || !getHeaderInfo.median_created_at) {
        return cbk([503, 'FailedToReceiveMedianDate']);
      }

      // Roughly how long has it been since this block was created?
      const delayMs = Date.now() - Date.parse(getHeaderInfo.median_created_at);

      if (delayMs > networks[network].ms_per_block * staleBlockVariance) {
        return cbk([503, 'StaleRemoteBlockTime', delayMs]);
      }

      return cbk();
    }],
  },
  returnResult({}, cbk));
};

