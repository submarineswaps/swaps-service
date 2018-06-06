const addToMemoryCachedSet = require('./add_to_memory_cached_set');
const scopeKey = require('./scope_key');

/** Add a JSON value to a cached set

  {
    cache: <Cache Type String>
    key: <Key String>
    ms: <Cache Set for Milliseconds Number>
    sort: <Sort Key String>
    type: <Item Type String>
    value: <Value Object>
  }
*/
module.exports = ({cache, key, ms, sort, type, value}, cbk) => {
  if (!cache) {
    return cbk([400, 'ExpectedCacheTypeForSet']);
  }

  if (!key) {
    return cbk([400, 'ExpectedKeyForSet']);
  }

  if (!ms) {
    return cbk([400, 'ExpectedMsForSetCacheTimeout']);
  }

  if (!sort) {
    return cbk([400, 'ExpectedSortKeyForSet']);
  }

  if (!type) {
    return cbk([400, 'ExpectedTypeForSet']);
  }

  if (!value) {
    return cbk([400, 'ExpectedValueToAddToSet']);
  }

  const scopedKey = scopeKey({key, type});

  switch (cache) {
  case 'memory':
    return addToMemoryCachedSet({ms, sort, value, key: scopedKey}, cbk);

  default:
    return cbk([400, 'UnknownCacheTypeForSetAddition']);
  }
};

