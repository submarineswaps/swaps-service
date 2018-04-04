const asyncAuto = require('async/auto');
const {Transaction} = require('bitcoinjs-lib');

const completeSwapTransaction = require('./complete_swap_transaction');
const findSwapTransaction = require('./find_swap_transaction');
const {returnResult} = require('./../async-util');
const {swapAddress} = require('./../swaps');
const {swapOutput} = require('./../swaps');

const blockSearchDepth = 9;
const requiredConfCount = 0;

/** Check the status of a swap

  {
    destination_public_key: <Destination Public Key String>
    invoice: <Lightning Invoice String>
    payment_hash: <Payment Hash String>
    private_key: <Private Key String>
    redeem_script: <Redeem Script Hex String>
    refund_public_key_hash: <Refund Public Key Hash String>
    timeout_block_height: <Timeout Block Height Number>
  }

  @returns via cbk
  {
    [conf_wait_count]: <Confirmations to Wait Number>
    [output_index]: <Output Index Number>
    [output_tokens]: <Output Tokens Number>
    [payment_secret]: <Payment Secret Hex String>
    transaction_id: <Transaction Id Hex String>
  }
*/
module.exports = (args, cbk) => {
  return asyncAuto({
    validate: cbk => {
      if (!args.destination_public_key) {
        return cbk([400, 'ExpectedDestinationPublicKey']);
      }

      if (!args.invoice) {
        return cbk([400, 'ExpectedInvoice']);
      }

      if (!args.payment_hash) {
        return cbk([400, 'ExpectedPaymentHash']);
      }

      if (!args.private_key) {
        return cbk([400, 'ExpectedPrivateKey']);
      }

      if (!args.redeem_script) {
        return cbk([400, 'ExpectedRedeemScript']);
      }

      if (!args.refund_public_key_hash) {
        return cbk([400, 'ExpectedRefundPublicKeyHash']);
      }

      if (!args.timeout_block_height) {
        return cbk([400, 'ExpectedTimeoutBlockHeight']);
      }

      return cbk();
    },

    findSwapTransaction: ['validate', (_, cbk) => {
      return findSwapTransaction({
        block_search_depth: blockSearchDepth,
        destination_public_key: args.destination_public_key,
        network: 'testnet',
        payment_hash: args.payment_hash,
        refund_public_key_hash: args.refund_public_key_hash,
        timeout_block_height: args.timeout_block_height,
      },
      cbk);
    }],

    swapAddress: ['validate', (_, cbk) => {
      try {
        return cbk(null, swapAddress({
          destination_public_key: args.destination_public_key,
          payment_hash: args.payment_hash,
          refund_public_key_hash: args.refund_public_key_hash,
          timeout_block_height: args.timeout_block_height,
        }));
      } catch (e) {
        return cbk([500, 'CreateSwapAddressFailure', e]);
      }
    }],

    // Make sure that the transaction has been found
    checkTransactionDetected: ['findSwapTransaction', (res, cbk) => {
      if (!res.findSwapTransaction.transaction) {
        return cbk([402, 'FundingTransactionNotFound']);
      }

      return cbk();
    }],

    // Determine the number of remaining confirmations before swap execution
    remainingConfs: ['checkTransactionDetected', (res, cbk) => {
      const confCount = res.findSwapTransaction.confirmation_count || 0;

      return cbk(null, Math.max(requiredConfCount - confCount, 0));
    }],

    // Pending swap details
    pendingDetails: ['remainingConfs', (res, cbk) => {
      let swapUtxo;

      try {
        swapUtxo = swapOutput({
          p2sh_output_script: res.swapAddress.p2sh_output_script,
          transaction: res.findSwapTransaction.transaction,
          witness_output_script: res.swapAddress.witness_output_script,
        });
      } catch (e) {
        return cbk([500, 'ExpectedSwapUtxoDetails', e]);
      }

      return cbk(null, {
        conf_wait_count: res.remainingConfs,
        output_index: swapUtxo.output_index,
        output_tokens: swapUtxo.output_tokens,
        transaction_id: swapUtxo.transaction_id,
      });
    }],

    // Complete the swap transaction
    swapTransaction: ['findSwapTransaction', 'remainingConfs', (res, cbk) => {
      if (!!res.remainingConfs) {
        return cbk();
      }

      return completeSwapTransaction({
        invoice: args.invoice,
        network: 'testnet',
        private_key: args.private_key,
        redeem_script: args.redeem_script,
        transaction: res.findSwapTransaction.transaction,
      },
      cbk);
    }],

    // Current swap details
    swapDetails: ['pendingDetails', 'swapTransaction', (res, cbk) => {
      if (!!res.swapTransaction) {
        return cbk(null, {
          payment_secret: res.swapTransaction.payment_secret,
          transaction_id: res.swapTransaction.transaction_id,
        });
      } else {
        return cbk(null, {
          conf_wait_count: res.pendingDetails.conf_wait_count,
          output_index: res.pendingDetails.output_index,
          output_tokens: res.pendingDetails.output_tokens,
          transaction_id: res.pendingDetails.transaction_id,
        });
      }
    }],
  },
  returnResult({of: 'swapDetails'}, cbk));
};

