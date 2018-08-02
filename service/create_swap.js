const asyncAuto = require('async/auto');

const getAddressDetails = require('./get_address_details');
const getInvoiceDetails = require('./get_invoice_details');
const getFeeForSwap = require('./get_fee_for_swap');
const {getRecentChainTip} = require('./../blocks');
const {getRecentFeeRate} = require('./../blocks');
const {returnResult} = require('./../async-util');
const serverSwapKeyPair = require('./server_swap_key_pair');
const {swapAddress} = require('./../swaps');
const swapParameters = require('./swap_parameters');
const watchSwapOutput = require('./../scan/watch_swap_output');

const msPerSec = 1e3;

/** Create a swap quote.

  {
    cache: <Swap Cache Type String>
    invoice: <Lightning Invoice String>
    network: <Network Name String>
    refund: <Chain Address String>
  }

  @returns via cbk
  {
    destination_public_key: <Destination Public Key Hex String>
    fee_tokens_per_vbyte: <Fee Tokens Per Virtual Byte Number>
    invoice: <Lightning Invoice String>
    payment_hash: <Payment Hash Hex String>
    redeem_script: <Redeem Script Hex String>
    refund_address: <Refund Address String>
    refund_public_key_hash: <Refund Public Key Hash Hex String>
    swap_amount: <Swap Amount Number>
    swap_fee: <Swap Fee Tokens Number>
    swap_key_index: <Swap Key Index Number>
    swap_p2sh_address: <Swap Chain Legacy P2SH Base58 Address String>
    swap_p2sh_p2wsh_address: <Swap Chain P2SH Nested SegWit Address String>
    swap_p2wsh_address: <Swap Chain P2WSH Bech32 Address String>
    timeout_block_height: <Swap Expiration Date Number>
  }
*/
module.exports = ({cache, invoice, network, refund}, cbk) => {
  return asyncAuto({
    // Decode the refund address to make sure it seems reasonable
    getAddressDetails: cbk => {
      return getAddressDetails({network, address: refund}, cbk);
    },

    // Get info about the state of the chain
    getChainTip: cbk => getRecentChainTip({cache, network}, cbk),

    // Pull details about the invoice to pay
    getInvoice: cbk => getInvoiceDetails({cache, invoice, network}, cbk),

    // Get a recent fee rate value
    getRecentFeeRate: cbk => getRecentFeeRate({cache, network}, cbk),

    // Validate basic arguments
    validate: cbk => {
      if (!cache) {
        return cbk([400, 'ExpectedCacheToPlaceCreatedSwap']);
      }

      if (!invoice) {
        return cbk([400, 'ExpectedInvoice']);
      }

      if (!network) {
        return cbk([400, 'ExpectedNetworkForChainSwap']);
      }

      if (!refund) {
        return cbk([400, 'ExpectedRefundAddress']);
      }

      return cbk();
    },

    // Determine the HD key index for the swap key
    swapKeyIndex: ['validate', ({}, cbk) => {
      return cbk(null, Math.round(Date.now() / msPerSec));
    }],

    // Make a temporary server public key to send the swap to
    serverDestinationKey: ['swapKeyIndex', ({swapKeyIndex}, cbk) => {
      try {
        return cbk(null, serverSwapKeyPair({network, index: swapKeyIndex}));
      } catch (e) {
        return cbk([500, 'ExpectedValidSwapKeyPair', e]);
      }
    }],

    // Determine the refund address hash
    refundAddress: ['getAddressDetails', ({getAddressDetails}, cbk) => {
      const details = getAddressDetails;

      if (details.type !== 'p2pkh' && details.type !== 'p2wpkh') {
        return cbk([400, 'ExpectedPayToPublicKeyHashAddress']);
      }

      return cbk(null, {public_key_hash: details.hash || details.data});
    }],

    // Swap timeout block height
    timeoutBlockHeight: ['getChainTip', ({getChainTip}, cbk) => {
      let refundDelay;

      try {
        refundDelay = swapParameters({network}).refund_timeout;
      } catch (err) {
        return cbk([500, 'ExpectedKnownNetworkForRefundDelay', err]);
      }

      return cbk(null, getChainTip.height + refundDelay);
    }],

    // Create the swap address
    swapAddress: [
      'getInvoice',
      'refundAddress',
      'serverDestinationKey',
      'timeoutBlockHeight',
      'validate',
      (res, cbk) =>
    {
      try {
        return cbk(null, swapAddress({
          network,
          destination_public_key: res.serverDestinationKey.public_key,
          payment_hash: res.getInvoice.id,
          refund_public_key_hash: res.refundAddress.public_key_hash,
          timeout_block_height: res.timeoutBlockHeight,
        }));
      } catch (e) {
        return cbk([500, 'SwapAddressCreationFailure', e]);
      }
    }],

    // Swap fee component
    getSwapAmount: ['getInvoice', ({getInvoice}, cbk) => {
      return getFeeForSwap({
        cache,
        network,
        to: getInvoice.network,
        tokens: getInvoice.tokens,
      },
      cbk);
    }],

    // Add the created swap to the watch list
    watchSwap: [
      'getSwapAmount',
      'swapAddress',
      'swapKeyIndex',
      ({getSwapAmount, swapAddress, swapKeyIndex}, cbk) =>
    {
      return watchSwapOutput({
        cache,
        invoice,
        network,
        index: swapKeyIndex,
        script: swapAddress.redeem_script,
        tokens: getSwapAmount.tokens,
      },
      cbk);
    }],

    // Swap details
    swap: [
      'getInvoice',
      'getRecentFeeRate',
      'getSwapAmount',
      'refundAddress',
      'serverDestinationKey',
      'swapAddress',
      'swapKeyIndex',
      'timeoutBlockHeight',
      (res, cbk) =>
    {
      // BCH uses a different swap address type for p2sh
      const bchSwapAddress = res.swapAddress.bch_p2sh_address || null;

      return cbk(null, {
        invoice,
        destination_public_key: res.serverDestinationKey.public_key,
        fee_tokens_per_vbyte: res.getRecentFeeRate.fee_tokens_per_vbyte,
        payment_hash: res.getInvoice.id,
        redeem_script: res.swapAddress.redeem_script,
        refund_address: refund,
        refund_public_key_hash: res.refundAddress.public_key_hash,
        swap_amount: res.getSwapAmount.tokens,
        swap_fee: res.getSwapAmount.fee,
        swap_key_index: res.swapKeyIndex,
        swap_p2sh_address: bchSwapAddress || res.swapAddress.p2sh_address,
        swap_p2sh_p2wsh_address: res.swapAddress.p2sh_p2wsh_address,
        swap_p2wsh_address: res.swapAddress.p2wsh_address,
        timeout_block_height: res.timeoutBlockHeight,
      });
    }],
  },
  returnResult({of: 'swap'}, cbk));
};

