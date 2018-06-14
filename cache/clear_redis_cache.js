const redisCache = require('./redis_cache');

/** Clear the redis cache

  {}
*/
module.exports = ({}, cbk) => {
  const cache = redisCache({});

  cache.flushAll(err => {
    if (!!err) {
      return cbk([503, 'ErrorFlushingRedisCache', err]);
    }

    return cbk();
  });

  return;
};

