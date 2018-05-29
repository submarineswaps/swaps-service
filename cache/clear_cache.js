const clearMemoryCache = require('./clear_memory_cache');

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

  default:
    return cbk([400, 'UnknownCacheType']);
  }
};

