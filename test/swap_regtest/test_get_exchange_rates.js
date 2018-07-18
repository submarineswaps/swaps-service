const {test} = require('tap');
const {swapNetworks} = require('./../../chain/conf/api_constants');
const {mockAPI} = require('../macros');
const {reqGetExchangeRates} = require('./../../routers/apiMethods');

test(`test exchange rates`, t => {
  mockAPI({
    cache: 'memory',
    networks: swapNetworks,
    method: reqGetExchangeRates
  }, (err, res) => {
    if (!res.rates) {
      t.fail("InvalidGetExchangeRatesResponse")
    }
    t.end()

  });

});
