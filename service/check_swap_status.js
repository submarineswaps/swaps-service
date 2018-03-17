const asyncAuto = require('async/auto');
const {Transaction} = require('bitcoinjs-lib');

const completeSwapTransaction = require('./complete_swap_transaction');
const findSwapTransaction = require('./find_swap_transaction');
const {returnResult} = require('./../async-util');
const {swapAddress} = require('./../swaps');

const blockSearchDepth = 9;
const requiredConfCount = 6;

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

    swapTransaction: ['findSwapTransaction', 'swapAddress', (res, cbk) => {
      if (!res.findSwapTransaction.transaction) {
        return cbk([402, 'FundingTransactionNotFound']);
      }

      if (res.findSwapTransaction.confirmation_count < requiredConfCount) {
        const confirmationsCount = res.findSwapTransaction.confirmation_count;
        const transaction = res.findSwapTransaction.transaction;

        return cbk(null, {
          conf_wait_count: requiredConfCount - confirmationsCount,
          transaction_id: Transaction.fromHex(transaction).getId,
        });
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
  },
  returnResult({of: 'swapTransaction'}, cbk));
};

