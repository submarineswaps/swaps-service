const bodyParser = require('body-parser');
const {Router} = require('express');

const {checkSwapStatus} = require('./../service');
const {createSwap} = require('./../service');
const {returnJson} = require('./../async-util');

const apiConstants = require('./../chain/conf/api_constants.json');

// const cache = 'redis';
// const apiConstants.swapNetworks = ['bchtestnet', 'ltctestnet', 'testnet'];

const {reqGetAddressDetails} = require('./apiMethods');
const {reqGetExchangeRates} = require('./apiMethods');
const {reqGetInvoiceDetails} = require('./apiMethods');
const {reqFindSwapOutpoint} = require('./apiMethods');
const {reqCreateSwap} = require('./apiMethods');
const {reqCheckSwapStatus} = require('./apiMethods');

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
  router.get('/address_details/:network/:address', (req, res) => reqGetAddressDetails(req, res, log));

  // GET exchange rate information
  router.get('/exchange_rates/', reqGetExchangeRates);

  // GET details about an invoice
  router.get('/invoice_details/:network/:invoice', reqGetInvoiceDetails);

  // POST a swap output find details request
  router.post('/swap_outputs/', (req, res) => {reqFindSwapOutpoint(req, res, log)});

  // POST a new swap
  router.post('/swaps/', ({body}, res) => {
    return createSwap({
        cache: apiConstants.cache,
        invoice: body.invoice,
        network: body.network,
        refund: body.refund,
      },
      returnJson({log, res}));
  });

  // POST a swap check request
  router.post('/swaps/check', ({body, params}, res) => {
    return checkSwapStatus({
        cache: apiConstants.cache,
        invoice: body.invoice,
        network: body.network,
        script: body.redeem_script,
      },
      returnJson({log, res}));
  });

  return router;
};

