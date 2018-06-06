const asyncAuto = require('async/auto');

const {getJsonFromCache} = require('./../cache');
const {swapScriptDetails} = require('./../swaps');
const {returnResult} = require('./../async-util');

/** Get the claim key index for a given swap redeem script

  {
    cache: <Cache Type String>
    script: <Redeem Script Hex String>
  }

  @returns via cbk
  {
    [index]: <Claim Key Index Number>
  }
*/
module.exports = ({cache, script}, cbk) => {
  return asyncAuto({
    // Check arguments
    validate: cbk => {
      if (!cache) {
        return cbk([400, 'ExpectedCacheForKeyLinking']);
      }

      if (!script) {
        return cbk([400, 'ExpectedScript']);
      }

      return cbk();
    },

    // Pull out swap details from the redeem script
    swapDetails: ['validate', ({}, cbk) => {
      try {
        return cbk(null, swapScriptDetails({script}));
      } catch (e) {
        return cbk([500, 'FailedToDeriveSwapDetails', e]);
      }
    }],

    // Get cached swap key
    getCachedSwapKey: ['swapDetails', ({swapDetails}, cbk) => {
      return getJsonFromCache({
        cache,
        key: swapDetails.destination_public_key,
        type: 'swap_key',
      },
      cbk);
    }],

    // Final swap key result
    swapKey: ['getCachedSwapKey', ({getCachedSwapKey}, cbk) => {
      if (!getCachedSwapKey || !getCachedSwapKey.index) {
        return cbk(null, {});
      }

      return cbk(null, {index: getCachedSwapKey.index});
    }],
  },
  returnResult({of: 'swapKey'}, cbk));
};

