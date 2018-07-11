const asyncAuto = require('async/auto');
const asyncRetry = require('async/retry');
const {includes} = require('lodash');
const request = require('request');

const {getJsonFromCache} = require('./../cache');
const {returnResult} = require('./../async-util');
const {setJsonInCache} = require('./../cache');

const api = 'https://apiv2.bitcoinaverage.com/';
const centsPerUnit = 100;
const decBase = 10;
const divisibilityFactor = 1e8;
const interval = retryCount => 50 * Math.pow(2, retryCount); // Retry backoff
const rateCacheTimeMs = 1000 * 60 * 10;
const remoteServiceTimeoutMs = 1000 * 20;
const times = 10; // Retry times

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
      case 'bchtestnet':
        return cbk(null, 'BCH');

      case 'ltctestnet':
        return cbk(null, 'LTC');

      case 'testnet':
        return cbk(null, 'BTC');

      default:
        return cbk([400, 'UnexpectedNetworkForExchangeRate', network]);
      }
    }],

    // Get the cached exchange rate
    getCached: ['validate', ({}, cbk) => {
      return getJsonFromCache({cache, key: network, type: 'fiat_rate'}, cbk);
    }],

    // Get the fresh exchange rate
    getFresh: [
      'currencyCode',
      'getCached',
      ({currencyCode, getCached}, cbk) =>
    {
      // Exit early when there is already a cached version
      if (!!getCached && !!getCached.cents) {
        return cbk();
      }

      return asyncRetry({interval, times}, cbk => {
        return request({
          json: true,
          timeout: remoteServiceTimeoutMs,
          url: `${api}indices/global/ticker/${currencyCode}USD`,
        },
        (err, r, body) => {
          if (!!err) {
            return cbk([503, 'FailedToGetExchangeRate', err]);
          }

          if (!body || !body.last) {
            return cbk([500, 'ExpectedExchangeRateData', body]);
          }

          const cents = parseInt(body.last * centsPerUnit, decBase);

          return cbk(null, {cents});
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
        key: network,
        ms: rateCacheTimeMs,
        type: 'fiat_rate',
        value: {cents: getFresh.cents},
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

