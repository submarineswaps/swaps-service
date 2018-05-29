const getFromMemoryCache = require('./get_from_memory_cache');
const scopeKey = require('./scope_key');

/** Get JSON value from a cache

  {
    cache: <Cache Name String>
    key: <Key String>
    type: <Type String>
  }

  @returns via cbk
  <Cached Object> || null
*/
module.exports = ({cache, key, type}, cbk) => {
  if (!cache) {
    return cbk([400, 'ExpectedCacheToFindValue']);
  }

  if (!key) {
    return cbk([400, 'ExpectedValueKey']);
  }

  if (!type) {
    return cbk([400, 'ExpectedValueType']);
  }

  const scopedKey = scopeKey({key, type});

  switch (cache) {
  case 'memory':
    return getFromMemoryCache({key: scopedKey}, cbk);

  default:
    return cbk([400, 'UnexpectedCacheType', cache]);
  }
};

