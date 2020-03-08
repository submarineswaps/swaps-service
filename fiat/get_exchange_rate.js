const asyncAuto = require('async/auto');
const asyncRetry = require('async/retry');
const {includes} = require('lodash');
const request = require('@alexbosworth/request');
const {returnResult} = require('asyncjs-util');

const {getJsonFromCache} = require('./../cache');
const {setJsonInCache} = require('./../cache');

const api = 'https://api.coinbase.com/v2/prices';
const centsPerUnit = 100;
const divisibilityFactor = 1e8;
const {floor} = Math;
const interval = retryCount => 50 * Math.pow(2, retryCount); // Retry backoff
const rateCacheTimeMs = 1000 * 60 * 10;
const remoteServiceTimeoutMs = 1000 * 20;
const times = 10; // Retry times
const type = 'get_exchange_rate';

/** Get the number of cents for a network's tokens

  {
    cache: <Cache Type String>
    network: <Currency String>
  }

  @returns via cbk
  {
    cents: <Cents Per Token Number>
  }
*/
module.exports = ({cache, network}, cbk) => {
  return asyncAuto({
    // Check arguments
    validate: cbk => {
      if (!cache) {
        return cbk([400, 'ExpectedCacheTypeForCachingExchangeRate']);
      }

      if (!network) {
        return cbk([400, 'ExpectedNetworkForExchangeRate']);
      }

      return cbk();
    },

    // Currency code for remote service
    currencyCode: ['validate', ({}, cbk) => {
      switch (network) {
      case 'bch':
      case 'bchtestnet':
        return cbk(null, 'BCH');

      case 'bitcoin':
      case 'regtest':
      case 'testnet':
        return cbk(null, 'BTC');

      case 'ltc':
      case 'ltctestnet':
        return cbk(null, 'LTC');

      default:
        return cbk([400, 'UnexpectedNetworkForExchangeRate', network]);
      }
    }],

    // Get the cached exchange rate
    getCached: ['validate', ({}, cbk) => {
      return getJsonFromCache({cache, type, key: network}, cbk);
    }],

    // Get the fresh exchange rate
    getFresh: [
      'currencyCode',
      'getCached',
      ({currencyCode, getCached}, cbk) =>
    {
      const cachedTime = getCached && getCached.time ? getCached.time : 0;

      const isStale = (Date.now() - cachedTime) > rateCacheTimeMs;

      // Exit early when there is already a cached version
      if (!isStale && !!getCached && !!getCached.cents) {
        return cbk();
      }

      return asyncRetry({interval, times}, cbk => {
        return request({
          json: true,
          timeout: remoteServiceTimeoutMs,
          url: `${api}/${currencyCode}-USD/spot`
        },
        (err, r, body) => {
          if (!!err) {
            return cbk([503, 'FailedToGetExchangeRate', err]);
          }

          if (!body || !body.data || !body.data.amount) {
            return cbk([500, 'ExpectedExchangeRateData', body]);
          }

          const cents = floor(parseFloat(body.data.amount) * centsPerUnit);
          const time = Date.now();

          return cbk(null, {cents, time});
        });
      },
      cbk);
    }],

    // Set the cached exchange rate
    setCached: ['getCached', 'getFresh', ({getCached, getFresh}, cbk) => {
      // Exit early when there are no fresh results to cache
      if (!getFresh) {
        return cbk();
      }

      return setJsonInCache({
        cache,
        type,
        key: network,
        ms: rateCacheTimeMs,
        value: {cents: getFresh.cents, time: getFresh.time},
      },
      cbk);
    }],

    // Final cents per token value
    centsPerToken: ['getCached', 'getFresh', ({getCached, getFresh}, cbk) => {
      const cents = (getFresh || getCached).cents / divisibilityFactor;

      return cbk(null, {cents});
    }],
  },
  returnResult({of: 'centsPerToken'}, cbk));
};

