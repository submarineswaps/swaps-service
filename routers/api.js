const bodyParser = require('body-parser');
const {Router} = require('express');

const {checkSwapStatus} = require('./../service');
const {createSwap} = require('./../service');

const {reqGetAddressDetails} = require('./apiMethods');
const {reqGetExchangeRates} = require('./apiMethods');
const {reqGetInvoiceDetails} = require('./apiMethods');
const {reqFindSwapOutpoint} = require('./apiMethods');
const {reqCreateSwap} = require('./apiMethods');
const {reqCheckSwapStatus} = require('./apiMethods');
const {reqBroadcastTransaction} = require('./apiMethods');


/** Make an api router

 {
   log: <Log Function>
 }

 @returns
   <Router Object>
 */


module.exports = ({log}) => {
  const router = Router({caseSensitive: true});
  router.use(bodyParser.json());

  // GET details about an address
  router.get('/address_details/:network/:address', (req, res) => {return reqGetAddressDetails({req, res, log})});

  // GET exchange rate information
  router.get('/exchange_rates/', (req, res) => reqGetExchangeRates({req, res, log}));

  // GET details about an invoice
  router.get('/invoice_details/:network/:invoice', reqGetInvoiceDetails);

  // POST a swap output find details request
  router.post('/swap_outputs/', (req, res) => {reqFindSwapOutpoint({req, res, log})});

  // POST a new swap
  router.post('/swaps/', (req, res) => {return reqCreateSwap({req, res, log})});

  // POST a swap check request
  router.post('/swaps/check', (req, res) => {return reqCheckSwapStatus({req, res, log})});

  // POST a transaction to broadcast to the network
  router.post('/transactions/', (req, res) => {return reqBroadcastTransaction({req, res, log})});

  return router;
};

