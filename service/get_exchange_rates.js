const asyncAuto = require('async/auto');
const asyncMap = require('async/map');

const {getExchangeRate} = require('./../fiat');
const {returnResult} = require('./../async-util');

const networkRates = {
  ltctestnet: [{
    base: 30000, network: 'testnet', rate: 14900,
  }],
  testnet: [{
    base: 1000, network: 'testnet', rate: 1000,
  }],
};

/** Get the exchange rates for trading

  {
    cache: <Cache Type String>
  }

  @returns via cbk
  {
    rates: [{
      cents: <Exchange Rate in Cents Per Token Number>
      fees: [{
        base: <Base Fee In Tokens Number>
        rate: <Rate Per Million Tokens Number>
        network: <Send to Lightning Network Name String>
      }]
      network: <Network Name String>
    }]
  }
*/
module.exports = ({cache}, cbk) => {
  return asyncAuto({
    // Check arguments
    validate: cbk => {
      if (!cache) {
        return cbk([400, 'ExpectedCacheTypeForExchangeRatesLookup']);
      }

      return cbk();
    },

    // Pull out the rates for supported networks
    getRates: ['validate', ({}, cbk) => {
      return asyncMap(Object.keys(networkRates), (network, cbk) => {
        return getExchangeRate({cache, network}, (err, res) => {
          if (!!err) {
            return cbk(err);
          }

          const fees = networkRates[network];

          return cbk(null, {fees, network, cents: res.cents});
        });
      },
      cbk);
    }],

    // Final rates
    rates: ['getRates', ({getRates}, cbk) => {
      return cbk(null, {rates: getRates});
    }],
  },
  returnResult({of: 'rates'}, cbk));
};

