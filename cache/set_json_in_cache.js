const scopeKey = require('./scope_key');
const setInMemoryCache = require('./set_in_memory_cache');

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
    return setInMemoryCache({key: scopedKey, ms, type, value}, cbk);

  default:
    return cbk([400, 'UnknownCacheType']);
  }
};

