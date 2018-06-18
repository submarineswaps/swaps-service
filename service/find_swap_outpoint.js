const asyncAuto = require('async/auto');

const findSwapTransaction = require('./find_swap_transaction');
const {getChainFeeRate} = require('./../chain');
const {returnResult} = require('./../async-util');
const {swapAddress} = require('./../swaps');
const {swapOutput} = require('./../swaps');
const {swapScriptDetails} = require('./../swaps');

const blockSearchDepth = 288;

/** Find a swap outpoint given a swap pkhash redeem script

  {
    network: <Network Name String>
    redeem_script: <Redeem Script Hex String>
  }

  @returns via cbk
  {
    fee_tokens_per_vbyte: <Fee Tokens Per VByte Number>
    refund_p2wpkh_address: <Refund P2WPKH Address String>
    timelock_block_height: <Locked Until Height Number>
    [utxo]: {
      output_index: <Transaction Output Index Number>
      output_tokens: <Transaction Output Tokens Number>
      transaction_id: <Transaction With Swap Output Id Hex String>
    }
  }
*/
module.exports = (args, cbk) => {
  return asyncAuto({
    // Get the chain fee rate
    getChainFeeRate: cbk => getChainFeeRate({network: args.network}, cbk),

    // Validate arguments
    validate: cbk => {
      if (!args.redeem_script) {
        return cbk([400, 'ExpectedRedeemScript']);
      }

      return cbk();
    },

    // Derive swap details
    swapDetails: ['validate', ({}, cbk) => {
      try {
        return cbk(null, swapScriptDetails({
          network: args.network,
          script: args.redeem_script,
        }));
      } catch (e) {
        return cbk([500, 'FailedToDeriveSwapDetails', e]);
      }
    }],

    // Swap address
    swapAddress: ['swapDetails', ({swapDetails}, cbk) => {
      try {
        return cbk(null, swapAddress({
          destination_public_key: swapDetails.destination_public_key,
          network: args.network,
          payment_hash: swapDetails.payment_hash,
          refund_public_key_hash: swapDetails.refund_public_key_hash,
          timeout_block_height: swapDetails.timelock_block_height,
        }));
      } catch (e) {
        return cbk([500, 'SwapAddressFailure', e]);
      }
    }],

    // Find the swap transaction
    findSwapTransaction: ['swapDetails', ({swapDetails}, cbk) => {
      return findSwapTransaction({
        block_search_depth: blockSearchDepth,
        destination_public_key: swapDetails.destination_public_key,
        is_ignoring_tokens: true,
        network: args.network,
        payment_hash: swapDetails.payment_hash,
        refund_public_key_hash: swapDetails.refund_public_key_hash,
        timeout_block_height: swapDetails.timelock_block_height,
      },
      cbk);
    }],

    // Pull the swap output details out of the transaction
    utxo: ['findSwapTransaction', 'swapAddress', (res, cbk) => {
      if (!res.findSwapTransaction.transaction) {
        return cbk();
      }

      try {
        return cbk(null, swapOutput({
          p2sh_output_script: res.swapAddress.p2sh_output_script,
          p2sh_p2wsh_output_script: res.swapAddress.p2sh_p2wsh_output_script,
          transaction: res.findSwapTransaction.transaction,
          witness_output_script: res.swapAddress.witness_output_script,
        }));
      } catch (e) {
        return cbk([500, 'ExpectedSwapOutput', e]);
      }
    }],

    // Final swap data
    outpointInfo: ['getChainFeeRate', 'swapDetails', 'utxo', (res, cbk) => {
      return cbk(null, {
        fee_tokens_per_vbyte: res.getChainFeeRate.fee_tokens_per_vbyte,
        refund_p2wpkh_address: res.swapDetails.refund_p2wpkh_address,
        timelock_block_height: res.swapDetails.timelock_block_height,
        utxo: res.utxo || undefined,
      });
    }],
  },
  returnResult({of: 'outpointInfo'}, cbk));
};

