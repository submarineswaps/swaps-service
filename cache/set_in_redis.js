const {round} = Math;

const redisCache = require('./redis_cache');

const msPerSec = 1e3;

/** Set a value in the redis cache

  {
    key: <Scoped Key String>
    ms: <Milliseconds to Cache Number>
    value: <Value String>
  }
*/
module.exports = ({key, ms, value}, cbk) => {
  if (!key) {
    return cbk([400, 'ExpectedKey']);
  }

  if (!ms) {
    return cbk([400, 'ExpectedMs']);
  }

  if (!value) {
    return cbk([400, 'ExpectedValue']);
  }

  if (typeof value !== 'string') {
    return cbk([400, 'ExpectedStringValue', value]);
  }

  const cache = redisCache({});

  cache.setex(key, round(ms / msPerSec), value, err => {
    if (!!err) {
      return cbk([500, 'UnexpectedSetRedisError', err]);
    }

    return cbk();
  });

  return;
};

