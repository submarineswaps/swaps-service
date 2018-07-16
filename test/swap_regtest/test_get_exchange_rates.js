const {test} = require('tap');
const cache = 'redis';
const swapNetworks = ['bchtestnet', 'ltctestnet', 'testnet'];
const {mockAPI} = require('../macros');
const {reqGetExchangeRates} = require('./../../routers/apiMethods')

test(`test exchange rates`, t => {
  let v = mockAPI({
    cache,
    networks: swapNetworks,
    method: reqGetExchangeRates
  });
  console.log(v);

});
