const asyncAuto = require('async/auto');
const {ECPair} = require('bitcoinjs-lib');
const {networks} = require('bitcoinjs-lib');

const getAddressDetails = require('./get_address_details');
const {getBlockchainInfo} = require('./../chain');
const getInvoiceDetails = require('./get_invoice_details');
const {returnResult} = require('./../async-util');
const {swapAddress} = require('./../swaps');

const network = 'testnet';
const swapRate = 0.015;
const timeoutBlockCount = 1;

/** Create a swap quote.

  {
    currency: <Currency Code String>
    invoice: <Lightning Invoice String>
    refund_address: <Chain Address String>
  }

  @returns via cbk
  {
    destination_public_key: <Destination Public Key Hex String>
    invoice: <Lightning Invoice String>
    payment_hash: <Payment Hash Hex String>
    private_key: <Private Key WIF String>
    refund_address: <Refund Address String>
    refund_public_key_hash: <Refund Public Key Hash Hex String>
    redeem_script: <Redeem Script Hex String>
    swap_amount: <Swap Amount Number>
    swap_p2sh_address: <Swap Chain Legacy P2SH Base58 Address String>
    swap_p2wsh_address: <Swap Chain P2WSH Bech32 Address String>
    timeout_block_height: <Swap Expiration Date Number>
  }
*/
module.exports = (args, cbk) => {
  return asyncAuto({
    // Decode the refund address
    getAddressDetails: cbk => {
      return getAddressDetails({address: args.refund_address}, cbk);
    },

    // Get the blockchain
    getBlockchainInfo: cbk => getBlockchainInfo({network}, cbk),

    // Decode the invoice to pay
    getInvoiceDetails: cbk => {
      return getInvoiceDetails({invoice: args.invoice}, cbk);
    },

    // Make a temporary server public key to send the swap to
    serverDestinationKey: cbk => {
      const keyPair = ECPair.makeRandom({network: networks.testnet});

      return cbk(null, {
        private_key: keyPair.toWIF(),
        public_key: keyPair.getPublicKeyBuffer().toString('hex'),
      });
    },

    // Validate basic arguments
    validate: cbk => {
      if (args.currency !== 'tBTC') {
        return cbk([400, 'ExpectedKnownCurrency']);
      }

      if (!args.invoice) {
        return cbk([400, 'ExpectedInvoice']);
      }

      if (!args.refund_address) {
        return cbk([400, 'ExpectedRefundAddress']);
      }

      return cbk();
    },

    // Determine the refund address hash
    refundAddress: ['getAddressDetails', (res, cbk) => {
      const details = res.getAddressDetails;

      if (details.type !== 'p2pkh' && details.type !== 'p2wpkh') {
        return cbk([400, 'ExpectedPayToPublicKeyHashAddress']);
      }

      if (!details.is_testnet) {
        return cbk([400, 'ExpectedTestnetAddress']);
      }

      return cbk(null, {public_key_hash: details.hash || details.data});
    }],

    timeoutBlockHeight: ['getBlockchainInfo', ({getBlockchainInfo}, cbk) => {
      return cbk(null, getBlockchainInfo.current_height + timeoutBlockCount);
    }],

    // Create the swap address
    swapAddress: [
      'getInvoiceDetails',
      'refundAddress',
      'serverDestinationKey',
      'timeoutBlockHeight',
      'validate',
      (res, cbk) =>
    {
      try {
        return cbk(null, swapAddress({
          destination_public_key: res.serverDestinationKey.public_key,
          payment_hash: res.getInvoiceDetails.id,
          refund_public_key_hash: res.refundAddress.public_key_hash,
          timeout_block_height: res.timeoutBlockHeight,
        }));
      } catch (e) {
        return cbk([500, 'SwapAddressCreationFailure', e]);
      }
    }],

    // Swap fee component
    fee: ['getInvoiceDetails', (res, cbk) => {
      return cbk(null, Math.round(res.getInvoiceDetails.tokens * swapRate));
    }],

    // Swap details
    swap: ['fee', 'swapAddress', 'timeoutBlockHeight', (res, cbk) => {
      return cbk(null, {
        destination_public_key: res.serverDestinationKey.public_key,
        invoice: args.invoice,
        payment_hash: res.getInvoiceDetails.id,
        private_key: res.serverDestinationKey.private_key,
        refund_address: args.refund_address,
        refund_public_key_hash: res.refundAddress.public_key_hash,
        redeem_script: res.swapAddress.redeem_script,
        swap_p2sh_address: res.swapAddress.p2wsh_address,
        swap_p2wsh_address: res.swapAddress.p2sh_p2wsh_address,
        swap_amount: res.getInvoiceDetails.tokens + res.fee,
        swap_fee: res.fee,
        timeout_block_height: res.timeoutBlockHeight,
      });
    }],
  },
  returnResult({of: 'swap'}, cbk));
};

