const redisCache = require('./redis_cache');

/** Delete a value from the redis cache

  {
    key: <Scoped Key String>
  }
*/
module.exports = ({key}, cbk) => {
  if (!key) {
    return cbk([400, 'ExpectedKey']);
  }

  const cache = redisCache({});

  cache.del(key, err => {
    if (!!err) {
      return cbk([500, 'UnexpectedDelFromRedisError', err]);
    }

    return cbk();
  });

  return;
};

