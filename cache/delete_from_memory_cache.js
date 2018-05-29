const memoryCache = require('./memory_cache');

/** Delete a value from the memory cache

  {
    key: <Scoped Key String>
  }
*/
module.exports = ({key}, cbk) => {
  if (!key) {
    return cbk([400, 'ExpectedKey']);
  }

  const cache = memoryCache({});

  cache.del(key, (err) => {
    if (!!err) {
      return cbk([500, 'UnexpectedDelFromMemoryCacheError', err]);
    }

    return cbk();
  });

  return;
};

