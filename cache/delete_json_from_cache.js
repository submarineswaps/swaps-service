const scopeKey = require('./scope_key');

const deleteFromRedis = require('./delete_from_redis');
const deleteInMemoryCache = require('./delete_from_memory_cache');

/** Delete JSON from the cache

  {
    cache: <Cache Type String>
    key: <Cache Key String>
    type: <Key Type String>
  }
*/
module.exports = ({cache, key, type}) => {
  if (!cache) {
    return cbk([400, 'ExpectedCacheToDeleteIn']);
  }

  if (!key) {
    return cbk([400, 'ExpectedValueKey']);
  }

  if (!type) {
    return cbk([400, 'ExpectedValueType']);
  }

  switch (cache) {
  case 'memory':
    return deleteInMemoryCache({key: scopeKey({key, type})}, cbk);

  case 'redis':
    return deleteFromRedis({key: scopeKey({key, type})}, cbk);

  default:
    return cbk([400, 'UnexpectedCacheType']);
  }
};

