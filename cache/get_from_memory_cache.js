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

  cache.get(key, (err, value) => {
    if (!!err) {
      return cbk([500, 'UnexpectedGetFromMemoryCacheError', err]);
    }

    return cbk(null, value || undefined);
  });

  return;
};

