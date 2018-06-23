const asyncAuto = require('async/auto');

const getAddressDetails = require('./get_address_details');
const getInvoiceDetails = require('./get_invoice_details');
const getFeeForSwap = require('./get_fee_for_swap');
const {getRecentChainTip} = require('./../blocks');
const {returnResult} = require('./../async-util');
const serverSwapKeyPair = require('./server_swap_key_pair');
const {swapAddress} = require('./../swaps');
const watchSwapOutput = require('./../scan/watch_swap_output');

const timeoutBlockCount = 144;

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
    // Decode the refund address
    getAddressDetails: cbk => {
      return getAddressDetails({network, address: refund}, cbk);
    },

    // Get info about the state of the chain
    getChainTip: cbk => getRecentChainTip({cache, network}, cbk),

    // Decode the invoice to pay
    getInvoiceDetails: cbk => getInvoiceDetails({invoice}, cbk),

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
    swapKeyIndex: ['getChainTip', ({getChainTip}, cbk) => {
      return cbk(null, getChainTip.height);
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
      return cbk(null, getChainTip.height + timeoutBlockCount);
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
          network,
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
    fee: ['getInvoiceDetails', ({getInvoiceDetails}, cbk) => {
      const {tokens} = getInvoiceDetails;

      return getFeeForSwap({cache, network, tokens}, cbk);
    }],

    // Add the created swap to the watch list
    watchSwap: [
      'swapAddress',
      'swapKeyIndex',
      ({swapAddress, swapKeyIndex}, cbk) =>
    {
      const index = swapKeyIndex;
      const script = swapAddress.redeem_script;

      return watchSwapOutput({cache, index, invoice, network, script}, cbk);
    }],

    // Swap details
    swap: [
      'fee',
      'getInvoiceDetails',
      'refundAddress',
      'serverDestinationKey',
      'swapAddress',
      'swapKeyIndex',
      'timeoutBlockHeight',
      (res, cbk) =>
    {
      return cbk(null, {
        invoice,
        destination_public_key: res.serverDestinationKey.public_key,
        payment_hash: res.getInvoiceDetails.id,
        redeem_script: res.swapAddress.redeem_script,
        refund_address: refund,
        refund_public_key_hash: res.refundAddress.public_key_hash,
        swap_amount: res.getInvoiceDetails.tokens + res.fee.tokens,
        swap_fee: res.fee.tokens,
        swap_key_index: res.swapKeyIndex,
        swap_p2sh_address: res.swapAddress.p2sh_address,
        swap_p2sh_p2wsh_address: res.swapAddress.p2sh_p2wsh_address,
        swap_p2wsh_address: res.swapAddress.p2wsh_address,
        timeout_block_height: res.timeoutBlockHeight,
      });
    }],
  },
  returnResult({of: 'swap'}, cbk));
};

