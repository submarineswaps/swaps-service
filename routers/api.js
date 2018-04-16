const bodyParser = require('body-parser');
const {Router} = require('express');

const {checkSwapStatus} = require('./../service');
const {createSwap} = require('./../service');
const {findSwapOutpoint} = require('./../service');
const {getAddressDetails} = require('./../service');
const {getInvoiceDetails} = require('./../service');
const {returnJson} = require('./../async-util');

const maxInvoiceFeeRate = 0.005;

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

    return getInvoiceDetails({
      invoice,
      max_invoice_fee_rate: maxInvoiceFeeRate,
    },
    returnJson({log, res}));
  });

  // POST a swap output find details request
  router.post('/swap_outputs/', ({body}, res) => {
    return findSwapOutpoint({
      network: 'testnet',
      redeem_script: body.redeem_script,
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
      redeem_script: body.redeem_script,
      refund_public_key_hash: body.refund_public_key_hash,
      swap_key_index: body.swap_key_index,
      timeout_block_height: body.timeout_block_height,
    },
    returnJson({log, res}));
  });

  return router;
};

