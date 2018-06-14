const scopeKey = require('./scope_key');
const setInMemoryCache = require('./set_in_memory_cache');
const setInRedis = require('./set_in_redis');

/** Set JSON value in a cache

  {
    cache: <Cache Type String>
    key: <Key String>
    ms: <Milliseconds to Cache Number>
    type: <Value Type String>
    value: <Value Object>
  }
*/
module.exports = ({cache, key, ms, type, value}, cbk) => {
  if (!cache) {
    return cbk([400, 'ExpectedCacheToSetValueIn']);
  }

  if (!key) {
    return cbk([400, 'ExpectedValueKey']);
  }

  if (!ms) {
    return cbk([400, 'ExpectedMs']);
  }

  if (!type) {
    return cbk([400, 'ExpectedValueType']);
  }

  if (!value) {
    return cbk([400, 'ExpectedValueToStore']);
  }

  const scopedKey = scopeKey({key, type});

  switch (cache) {
  case 'memory':
    return setInMemoryCache({ms, type, value, key: scopedKey}, cbk);

  case 'redis':
    return setInRedis({
      ms,
      value: JSON.stringify(value),
      key: scopedKey,
    },
    cbk);

  default:
    return cbk([400, 'UnknownCacheType']);
  }
};

