const bodyParser = require('body-parser');
const {Router} = require('express');

const {checkSwapStatus} = require('./../service');
const {createSwap} = require('./../service');
const {returnJson} = require('./../async-util');
const {getAddressDetails} = require('./../service');
const {getInvoiceDetails} = require('./../service');
const {getRefundDetails} = require('./../service');

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
  router.get('/address_details/:address', ({params}, res) => {
    const {address} = params;

    return getAddressDetails({address}, returnJson({log, res}));
  });

  // GET details about an invoice
  router.get('/invoice_details/:invoice', ({params}, res) => {
    const {invoice} = params;

    return getInvoiceDetails({invoice}, returnJson({log, res}));
  });

  // POST a refund transaction creation request
  router.post('/refunds/', ({body}, res) => {
    return getRefundDetails({
      destination_public_key: body.destination_public_key,
      network: 'testnet',
      payment_hash: body.payment_hash,
      redeem_script: body.redeem_script,
      refund_address: body.refund_address,
      timeout_block_height: body.timeout_block_height,
    },
    returnJson({log, res}));
  });

  // POST a new swap
  router.post('/swaps/', ({body}, res) => {
    return createSwap({
      currency: body.currency,
      invoice: body.invoice,
      refund_address: body.refund_address,
    },
    returnJson({log, res}));
  });

  // POST a swap check request
  router.post('/swaps/:payment_hash/', ({body, params}, res) => {
    return checkSwapStatus({
      destination_public_key: body.destination_public_key,
      invoice: body.invoice,
      payment_hash: params.payment_hash,
      private_key: body.private_key,
      redeem_script: body.redeem_script,
      refund_public_key_hash: body.refund_public_key_hash,
      timeout_block_height: body.timeout_block_height,
    },
    returnJson({log, res}));
  });

  return router;
};

