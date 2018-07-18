const bodyParser = require('body-parser');
const {Router} = require('express');

const {broadcastTransaction} = require('./../service');
const {checkSwapStatus} = require('./../service');
const {createSwap} = require('./../service');
const {findSwapOutpoint} = require('./../service');
const {getAddressDetails} = require('./../service');
const {getExchangeRates} = require('./../service');
const {getInvoiceDetails} = require('./../service');
const {returnJson} = require('./../async-util');

const cache = 'redis';
const swapNetworks = ['bchtestnet', 'ltctestnet', 'testnet'];

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
  router.get('/address_details/:network/:address', ({params}, res) => {
    const {address} = params;
    const {network} = params;

    return getAddressDetails({address, network}, returnJson({log, res}));
  });

  // GET exchange rate information
  router.get('/exchange_rates/', ({}, res) => {
    return getExchangeRates({
      cache,
      networks: swapNetworks,
    },
    returnJson({log, res}));
  });

  // GET details about an invoice
  router.get('/invoice_details/:network/:invoice', ({params}, res) => {
    return getInvoiceDetails({
      cache,
      invoice: params.invoice,
      network: params.network,
    },
    returnJson({log, res}));
  });

  // POST a swap output find details request
  router.post('/swap_outputs/', ({body}, res) => {
    return findSwapOutpoint({
      network: body.network,
      redeem_script: body.redeem_script,
    },
    returnJson({log, res}));
  });

  // POST a new swap
  router.post('/swaps/', ({body}, res) => {
    return createSwap({
      cache,
      invoice: body.invoice,
      network: body.network,
      refund: body.refund,
    },
    returnJson({log, res}));
  });

  // POST a swap check request
  router.post('/swaps/check', ({body}, res) => {
    return checkSwapStatus({
      cache,
      invoice: body.invoice,
      network: body.network,
      script: body.redeem_script,
    },
    returnJson({log, res}));
  });

  // POST a transaction to broadcast to the network
  router.post('/transactions/', ({body}, res) => {
    return broadcastTransaction({
      network: body.network,
      transaction: body.transaction,
    },
    returnJson({log, res}));
  });

  return router;
};

