const redisCache = require('./redis_cache');

/** Get a value from the redis cache

  {
    key: <Scoped Key String>
  }

  @returns via cbk
  <Value String> || null
*/
module.exports = ({key}, cbk) => {
  if (!key) {
    return cbk([400, 'ExpectedKeyForRedisCacheItem']);
  }

  const cache = redisCache({});

  cache.get(key, (err, value) => {
    if (!!err && err.code === 'UNCERTAIN_STATE') {
      return cbk();
    }

    if (!!err) {
      return cbk([503, 'UnexpectedRedisCacheError']);
    }

    return cbk(null, value || null);
  });

  return;
};

