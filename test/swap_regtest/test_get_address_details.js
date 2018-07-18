const {test} = require('tap');
const cache = 'memory';
const swapNetworks = ['bchtestnet', 'ltctestnet', 'testnet'];
const {mockAPI} = require('../macros');
const {reqGetAddressDetails} = require('./../../routers/apiMethods');


test(`test exchange rates`, t => {
  let v = mockAPI({
    cache,
    networks: swapNetworks,
    method: reqGetAddressDetails
  });
  console.log(v);

});


