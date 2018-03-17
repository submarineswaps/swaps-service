const asyncAuto = require('async/auto');

const findSwapTransaction = require('./find_swap_transaction');
const getAddressDetails = require('./get_address_details');
const {getBlockchainInfo} = require('./../chain');
const {getChainFeeRate} = require('./../chain');
const {getFee} = require('./../chain');
const {outputScriptInTransaction} = require('./../chain');
const {returnResult} = require('./../async-util');

const blockSearchDepth = 9;

/** Get a refund transaction

  {
    destination_public_key: <Destination Public Key Serialized String>
    network: <Network Name String>
    payment_hash: <Payment Hash String>
    redeem_script: <Redeem Script String>
    refund_address: <Refund Address String>
    timeout_block_height: <Swap Expiration Date Number>
  }

  @returns via cbk
  {
    current_block_height: <Current Block Height Number>
    destination: <Send Tokens to Address String>
    fee_tokens_per_vbyte: <Fee Per Virtual Byte Token Rate Number>
    utxos: [{
      redeem: <Redeem Script Hex String>
      tokens: <Tokens Number>
      transaction_id: <Transaction Id String>
      vout: <Vout Number>
    }]
  }
*/
module.exports = (args, cbk) => {
  return asyncAuto({
    // Check the current state of the blockchain to get a good locktime
    getBlockchainInfo: cbk => getBlockchainInfo({network: args.network}, cbk),

    // Figure out what fee is needed to sweep the funds
    getFee: cbk => getChainFeeRate({network: args.network}, cbk),

    // Check completion arguments
    validate: cbk => {
      if (!args.destination_public_key) {
        return cbk([400, 'ExpectedDestinationPublicKey']);
      }

      if (!args.network) {
        return cbk([400, 'ExpectedNetwork']);
      }

      if (!args.payment_hash) {
        return cbk([400, 'ExpectedPaymentHash']);
      }

      if (!args.redeem_script) {
        return cbk([400, 'ExpectedRedeemScript']);
      }

      if (!args.refund_address) {
        return cbk([400, 'ExpectedRefundAddress']);
      }

      if (!args.timeout_block_height) {
        return cbk([400, 'ExpectedTimeoutBlockHeight']);
      }

      return cbk();
    },

    // Get address details
    getAddressDetails: ['validate', (_, cbk) => {
      return getAddressDetails({address: args.refund_address}, cbk);
    }],

    // Refund public key hash
    refundPublicKeyHash: ['getAddressDetails', ({getAddressDetails}, cbk) => {
      return cbk(null, getAddressDetails.data || getAddressDetails.hash);
    }],

    // Scan past blocks to find the swap transaction
    findSwapTransaction: ['refundPublicKeyHash', (_, cbk) => {
      return findSwapTransaction({
        block_search_depth: blockSearchDepth,
        destination_public_key: args.destination_public_key,
        network: args.network,
        payment_hash: args.payment_hash,
        refund_public_key_hash: res.refundPublicKeyHash,
        timeout_block_height: args.timeout_block_height,
      },
      cbk);
    }],

    // Funding UTXOs from the transaction
    fundingUtxos: ['findSwapTransaction', ({findSwapTransaction}, cbk) => {
      try {
        return cbk(null, outputScriptInTransaction({
          redeem_script: args.redeem_script,
          transaction: findSwapTransaction.transaction,
        }));
      } catch (e) {
        return cbk([500, 'ErrorFindingOutputScript', e]);
      }
    }],

    // Final refund details needed to form the refund transaction
    refundDetails: [
      'fundingUtxos',
      'getBlockchainInfo',
      'getFee',
      ({fundingUtxos, getBlockchainInfo, getFee}, cbk) =>
    {
      return cbk(null, {
        current_block_height: getBlockchainInfo.current_height,
        destination: args.refund_address,
        fee_tokens_per_vbyte: getFee.fee_tokens_per_vbyte,
        utxos: fundingUtxos.matching_outputs,
      });
    }],
  },
  returnResult({of: 'refundDetails'}, cbk));
};

