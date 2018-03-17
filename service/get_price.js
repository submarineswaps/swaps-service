const asyncAuto = require('async/auto');
const asyncConstant = require('async/constant');
const coinTicker = require('coin-ticker');

const {returnResult} = require('./../async-util');

const cachedPrices = {};
const cachePriceMs = 1000 * 60 * 15;
const cents = 100;
const decBase = 10;

/** Get price

  {
    from_currency_code: <Currency Code String>
    to_currency_code: <Currency Code String>
  }

  @returns via cbk
  {
    quote: <Price Quote From Currency In To Currency In Base Units Number>
  }
*/
module.exports = (args, cbk) => {
  return asyncAuto({
    pair: asyncConstant(`${args.from_currency_code}_${args.to_currency_code}`),

    validate: cbk => {
      if (!args.from_currency_code) {
        return cbk([400, 'ExpectedFromCurrencyCode']);
      }

      if (!args.to_currency_code) {
        return cbk([500, 'ExpectedToCurrencyCode']);
      }

      return cbk();
    },

    getCachedPrice: ['pair', 'validate', ({pair}, cbk) => {
      const price = cachedPrices[pair];

      if (!price || price.cache_timeout > new Date().toISOString()) {
        return cbk();
      }

      return cbk(null, price.quote);
    }],

    getFreshPrice: ['getCachedPrice', 'pair', (res, cbk) => {
      if (!!res.getCachedPrice) {
        return cbk();
      }

      coinTicker('bitfinex', res.pair)
        .then(r => {
          if (!r || !r.last) {
            throw new Error('Expected last price');
          }

          cachedPrices[res.pair] = {
            cache_timeout: new Date(Date.now() + cachePriceMs).toISOString(),
            quote: parseInt(parseFloat(r.last, decBase) * cents, decBase),
          };

          return cbk(null, cachedPrices[res.pair].quote);
        })
        .catch(err => cbk([503, 'Error getting price', err]));

      return;
    }],

    price: ['getFreshPrice', 'pair', ({pair}, cbk) => {
      const {quote} = cachedPrices[pair];

      return cbk(null, {quote});
    }],
  },
  returnResult({of: 'price'}, cbk));
};

