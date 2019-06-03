const asyncAuto = require('async/auto');
const asyncMap = require('async/map');
const {returnResult} = require('asyncjs-util');

const {getExchangeRate} = require('./../fiat');
const swapParameters = require('./swap_parameters');

/** Get the exchange rates for trading

  {
    cache: <Cache Type String>
    networks: [<Network Name String>]
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
module.exports = ({cache, networks}, cbk) => {
  return asyncAuto({
    // Check arguments
    validate: cbk => {
      if (!cache) {
        return cbk([400, 'ExpectedCacheTypeForExchangeRatesLookup']);
      }

      if (!Array.isArray(networks) || !networks.length) {
        return cbk([400, 'ExpectedNetworksForExchangeRates']);
      }

      return cbk();
    },

    // Determine network rates
    networkRates: ['validate', ({}, cbk) => {
      try {
        const rates = {};

        const swapFees = networks.forEach(network => {
          rates[network] = swapParameters({network}).swap_fees;
        });

        return cbk(null, rates);
      } catch (err) {
        return cbk([500, 'FailedToGetNetworkRates', err]);
      }
    }],

    // Pull out the rates for supported networks
    getRates: ['networkRates', ({networkRates}, cbk) => {
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

