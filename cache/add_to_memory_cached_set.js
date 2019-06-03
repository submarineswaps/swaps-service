const asyncAuto = require('async/auto');
const {returnResult} = require('asyncjs-util');

const getFromMemoryCache = require('./get_from_memory_cache');
const setInMemoryCache = require('./set_in_memory_cache');

/** Add an element to a memory cached set

  Note: unlike a normal set, every addition will bump the set cache time.

  {
    key: <Key String>
    ms: <Cache Set for Milliseconds Number>
    sort: <Sort Key String>
    value: <Value Object>
  }
*/
module.exports = ({key, ms, sort, value}, cbk) => {
  return asyncAuto({
    // Check arguments
    validate: cbk => {
      if (!key) {
        return cbk([400, 'ExpectedSetKey']);
      }

      if (!ms) {
        return cbk([400, 'ExpectedSetCacheMs']);
      }

      if (!sort) {
        return cbk([400, 'ExpectedSetItemSortKey']);
      }

      if (!value) {
        return cbk([400, 'ExpectedSetItemValue']);
      }

      return cbk();
    },

    // Get the entire cache set.
    getCachedSet: ['validate', ({}, cbk) => getFromMemoryCache({key}, cbk)],

    // Update the cache set
    updateCachedSet: ['getCachedSet', ({getCachedSet}, cbk) => {
      const updatedSet = getCachedSet || {};

      updatedSet[sort] = value;

      return setInMemoryCache({key, ms, value: updatedSet}, cbk);
    }],
  },
  returnResult({}, cbk));
};

