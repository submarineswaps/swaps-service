const asyncAuto = require('async/auto');
const asyncMap = require('async/map');
const {returnResult} = require('asyncjs-util');

const getFromRedis = require('./get_from_redis');
const redisCache = require('./redis_cache');
const scopeKey = require('./scope_key');

/** Get a set from the memory cache

  {
    key: <Set Key String>
  }

  @returns via cbk
  {
    items: [<Set Item String>]
  }
*/
module.exports = ({key}, cbk) => {
  return asyncAuto({
    // Check arguments
    validate: cbk => {
      if (!key) {
        return cbk([400, 'ExpectedSetKeyToGet']);
      }

      return cbk();
    },

    // Redis cache connector
    client: cbk => cbk(null, redisCache({})),

    // Grab the keys of the set
    getKeys: ['client', 'validate', ({client}, cbk) => {
      return client.smembers(key, (err, sorts) => {
        if (!!err) {
          return cbk([503, 'RedisGetMembersError', err]);
        }

        return cbk(null, sorts.map(sort => scopeKey({key: sort, type: key})));
      });
    }],

    // Grab the items of the set
    getItems: ['getKeys', ({getKeys}, cbk) => {
      return asyncMap(getKeys, (key, cbk) => getFromRedis({key}, cbk), cbk);
    }],

    // Final items set
    items: ['getItems', ({getItems}, cbk) => {
      return cbk(null, {items: getItems.filter(n => !!n)});
    }],
  },
  returnResult({of: 'items'}, cbk));
};

