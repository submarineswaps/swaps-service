const {test} = require('tap');
const {log} = console;
const cache = 'redis';
const swapNetworks = ['bchtestnet', 'ltctestnet', 'testnet'];
const {returnJson} = require('./../async-util');
const {mockAPI} = require('../macros');
const {reqGetExchangeRates} = require('./../rou')


test(`test exchange rates`, t => {
  let v = mockAPI({
    cache,
    networks: swapNetworks,
    method: reqGetExchangeRates
  });
  console.log(v);

});


