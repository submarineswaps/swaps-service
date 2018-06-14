const {parse} = JSON;

const getCachedSetFromMemory = require('./get_cached_set_from_memory');
const getCachedSetFromRedis = require('./get_cached_set_from_redis');
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

  case 'redis':
    return getCachedSetFromRedis({key: scopedKey}, (err, res) => {
      if (!!err) {
        return cbk(err);
      }

      try {
        return cbk(null, {items: res.items.map(parse)});
      } catch (e) {
        return cbk([503, 'ExpectedJsonItemInRedisSet']);
      }
    });

  default:
    return cbk([400, 'UnexpectedSetCacheType', cache]);
  }
};

