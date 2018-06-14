const clearMemoryCache = require('./clear_memory_cache');
const clearRedisCache = require('./clear_redis_cache');

/** Clear a cache

  {
    cache: <Cache Type String>
  }
*/
module.exports = ({cache}, cbk) => {
  if (!cache) {
    return cbk([400, 'ExpectedCacheToClear']);
  }

  switch (cache) {
  case 'memory':
    return clearMemoryCache({}, cbk);

  case 'redis':
    return clearRedisCache({}, cbk);

  default:
    return cbk([400, 'UnknownCacheType']);
  }
};

