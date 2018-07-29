const {stringify} = JSON;

const asyncAuto = require('async/auto');

const redisCache = require('./redis_cache');
const {returnResult} = require('./../async-util');
const scopeKey = require('./scope_key');
const setInRedis = require('./set_in_redis');

const msPerSec = 1e3;

/** Add an element to a redis cached set

  {
    key: <Key String>
    ms: <Cache Set for Milliseconds Number>
    sort: <Sort Key String>
    value: <Value String>
  }
*/
module.exports = ({key, ms, sort, value}, cbk) => {
  return asyncAuto({
    // Check arguments
    validate: cbk => {
      if (!key) {
        return cbk([400, 'ExpectedRedisSetKey']);
      }

      if (!ms) {
        return cbk([400, 'ExpectedRedisExpiryTime']);
      }

      if (!sort) {
        return cbk([400, 'ExpectedSortValueForRedisSetId']);
      }

      if (!value) {
        return cbk([400, 'ExpectedRedisValueToAddToSet']);
      }

      return cbk();
    },

    // Redis cache client
    cache: cbk => cbk(null, redisCache({})),

    // Add item to set
    pushIntoSet: ['cache', 'validate', ({cache}, cbk) => {
      return cache.sadd(key, sort, err => {
        if (!!err) {
          return cbk([503, 'CacheAdditionFailure', err]);
        }

        return cbk();
      });
    }],

    // Expire set at timeout
    updateSetExpiry: ['cache', 'pushIntoSet', ({cache}, cbk) => {
      return cache.expire(key, ms / msPerSec, err => {
        if (!!err) {
          return cbk([503, 'CacheSetExpiryFailure', err]);
        }

        return cbk();
      });
    }],

    // Add item value
    setItem: ['cache', 'validate', ({cache}, cbk) => {
      const scopedKey = scopeKey({key: sort, type: key});

      return setInRedis({ms, key: scopedKey, value: stringify(value)}, cbk);
    }],
  },
  returnResult({}, cbk));

  return;
};

