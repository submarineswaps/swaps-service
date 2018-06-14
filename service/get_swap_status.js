const asyncAuto = require('async/auto');
const {parseInvoice} = require('ln-service');
const {Transaction} = require('bitcoinjs-lib');

const completeSwapTransaction = require('./complete_swap_transaction');
const findSwapTransaction = require('./find_swap_transaction');
const {getBlockchainInfo} = require('./../chain');
const {getSwapKeyIndex} = require('./../scan');
const {returnResult} = require('./../async-util');
const serverSwapKeyPair = require('./server_swap_key_pair');
const {swapOutput} = require('./../swaps');
const {swapScriptDetails} = require('./../swaps');

const blockSearchDepth = 9;
const minBlocksUntilRefundHeight = 70;
const requiredConfCount = 1;
const swapRate = 0.015;

/** Get the status of a pkhash swap

  This will attempt to execute the swap if it detects a funded swap.

  {
    cache: <Cache Name String>
    invoice: <Lightning Invoice String>
    network: <Network Name String>
    script: <Redeem Script Hex String>
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
module.exports = ({cache, invoice, network, script}, cbk) => {
  return asyncAuto({
    // Get the current chain height
    getChainInfo: cbk => {
      return getBlockchainInfo({network, is_cache_ok: true}, cbk);
    },

    // Parse the encoded invoice
    invoiceDetails: cbk => {
      if (!invoice) {
        return cbk([400, 'ExpectedInvoice']);
      }

      try {
        return cbk(null, parseInvoice({invoice}));
      } catch (e) {
        return cbk([400, 'InvalidInvoice', e]);
      }
    },

    // Check arguments
    validate: ['invoiceDetails', ({invoiceDetails}, cbk) => {
      if (!cache) {
        return cbk([400, 'ExpectedCacheForSwapDetails']);
      }

      if (!!invoiceDetails.is_expired) {
        return cbk([410, 'InvoiceExpired']);
      }

      if (!network) {
        return cbk([400, 'ExpectedSwapNetwork']);
      }

      if (!script) {
        return cbk([400, 'ExpectedRedeemScript']);
      }

      return cbk();
    }],

    // Figure out what swap key index corresponds to this redeem script
    getSwapKeyIndex: ['validate', ({}, cbk) => {
      return getSwapKeyIndex({cache, script}, cbk);
    }],

    // Pull out the swap keypair from the HD seed
    serverKeyPair: ['getSwapKeyIndex', ({getSwapKeyIndex}, cbk) => {
      const {index} = getSwapKeyIndex;

      if (!index) {
        return cbk([404, 'UnknownSwap']);
      }

      try {
        return cbk(null, serverSwapKeyPair({index, network}));
      } catch (e) {
        return cbk([500, 'ExpectedValidKeyPair', e]);
      }
    }],

    // Derive the swap info from the redeem script
    swapDetails: ['validate', ({}, cbk) => {
      try {
        return cbk(null, swapScriptDetails({script}));
      } catch (e) {
        return cbk([400, 'FailedToDeriveSwapDetails', e]);
      }
    }],

    // Make sure that the destination public key matches a server key
    checkDestinationPublicKey: ['serverKeyPair', 'swapDetails', (res, cbk) => {
      const redeemScriptPublicKey = res.swapDetails.destination_public_key;
      const serverPublicKey = res.serverKeyPair.public_key;

      if (serverPublicKey !== redeemScriptPublicKey) {
        return cbk([403, 'InvalidDestinationKey']);
      }

      return cbk();
    }],

    // Check that there is enough time left to swap
    checkTimelockHeight: ['swapDetails', 'getChainInfo', (res, cbk) => {
      const currentHeight = res.getChainInfo.current_height;
      const refundHeight = res.swapDetails.timelock_block_height;

      const blocksUntilRefundHeight = refundHeight - currentHeight;

      if (blocksUntilRefundHeight < minBlocksUntilRefundHeight) {
        return cbk([410, 'TradeExpired']);
      }

      return cbk();
    }],

    // Search for the swap transaction
    findSwapTransaction: [
      'checkDestinationPublicKey',
      'checkTimelockHeight',
      'invoiceDetails',
      'swapDetails',
      ({invoiceDetails, swapDetails}, cbk) =>
    {
      const {tokens} = invoiceDetails;

      return findSwapTransaction({
        cache,
        network,
        block_search_depth: blockSearchDepth,
        destination_public_key: swapDetails.destination_public_key,
        payment_hash: invoiceDetails.id,
        refund_public_key_hash: swapDetails.refund_public_key_hash,
        timeout_block_height: swapDetails.timelock_block_height,
        tokens: tokens + Math.round(tokens * swapRate),
      },
      cbk);
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
    pendingDetails: [
      'findSwapTransaction',
      'remainingConfs',
      'swapDetails',
      ({findSwapTransaction, remainingConfs, swapDetails}, cbk) =>
    {
      try {
        const swapUtxo = swapOutput({
          p2sh_output_script: swapDetails.p2sh_output_script,
          p2sh_p2wsh_output_script: swapDetails.p2sh_p2wsh_output_script,
          transaction: findSwapTransaction.transaction,
          witness_output_script: swapDetails.witness_output_script,
        });

        return cbk(null, {
          conf_wait_count: remainingConfs,
          output_index: swapUtxo.output_index,
          output_tokens: swapUtxo.output_tokens,
          transaction_id: swapUtxo.transaction_id,
        });
      } catch (e) {
        return cbk([500, 'ExpectedSwapUtxoDetails', e]);
      }
    }],

    // Complete the swap transaction
    swapTransaction: [
      'checkTransactionDetected',
      'findSwapTransaction',
      'remainingConfs',
      'serverKeyPair',
      ({findSwapTransaction, remainingConfs, serverKeyPair}, cbk) =>
    {
      // Exit early and abort swap when there are remaining confirmations
      if (remainingConfs > 0) {
        return cbk();
      }

      return completeSwapTransaction({
        cache,
        invoice,
        network,
        private_key: serverKeyPair.private_key,
        redeem_script: script,
        transaction: findSwapTransaction.transaction,
      },
      cbk);
    }],

    // Current swap status
    swapStatus: ['pendingDetails', 'swapTransaction', (res, cbk) => {
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
  returnResult({of: 'swapStatus'}, cbk));
};

