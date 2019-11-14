const memoryCache = require('./memory_cache');

/** Get a value from the memory cache

  {
    key: <Scoped Key String>
  }

  @returns via cbk
  <Value Object> || undefined
*/
module.exports = ({key}, cbk) => {
  if (!key) {
    return cbk([400, 'ExpectedKeyForMemoryCacheItem']);
  }

  const cache = memoryCache({});

  const value = cache.get(key);

  return cbk(null, value || undefined);
};
