const getCachedSetFromMemory = require('./get_cached_set_from_memory');
const scopeKey = require('./scope_key');

/** Get cached set JSON items

  {
    cache: <Cache Type String>
    key: <Key String>
    type: <Type String>
  }

  @returns via cbk
  {
    items: [<Value Object>]
  }
*/
module.exports = ({cache, key, type, value}, cbk) => {
  if (!cache) {
    return cbk([400, 'ExpectedCacheToGetSetIn']);
  }

  if (!key) {
    return cbk([400, 'ExpectedSetKeyToGet']);
  }

  if (!type) {
    return cbk([400, 'ExpectedSetKeyType']);
  }

  const scopedKey = scopeKey({key, type});

  switch (cache) {
  case 'memory':
    return getCachedSetFromMemory({key: scopedKey}, cbk);

  default:
    return cbk([400, 'UnexpectedSetCacheType', cache]);
  }
};

