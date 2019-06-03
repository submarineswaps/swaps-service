const asyncAuto = require('async/auto');
const {returnResult} = require('asyncjs-util');

const addDetectedSwap = require('./../pool/add_detected_swap');
const completeSwapTransaction = require('./complete_swap_transaction');
const {getBlockPlacement} = require('./../blocks');
const getFeeForSwap = require('./get_fee_for_swap');
const {getRecentChainTip} = require('./../blocks');
const {getSwapKeyIndex} = require('./../scan');
const {getTransaction} = require('./../blocks');
const {parsePaymentRequest} = require('./../lightning');
const serverSwapKeyPair = require('./server_swap_key_pair');
const {swapOutput} = require('./../swaps');
const swapParameters = require('./swap_parameters');
const {swapScriptDetails} = require('./../swaps');
const {Transaction} = require('./../tokenslib');

const blockSearchDepth = 9;
const minBlocksUntilRefundHeight = 70;
const priority = 0;

/** Get the status of a pkhash swap

  This will attempt to execute the swap if it detects a funded swap.

  {
    cache: <Cache Name String>
    id: <Transaction Id Hex String>
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
module.exports = ({block, cache, id, invoice, network, script}, cbk) => {
  return asyncAuto({
    // Get the current chain height
    getChainInfo: cbk => getRecentChainTip({network}, cbk),

    // Parse the encoded invoice
    invoiceDetails: cbk => {
      if (!invoice) {
        return cbk([400, 'ExpectedInvoice']);
      }

      try {
        return cbk(null, parsePaymentRequest({request: invoice}));
      } catch (err) {
        return cbk([400, 'InvalidInvoice', err]);
      }
    },

    // Check arguments
    validate: ['invoiceDetails', ({invoiceDetails}, cbk) => {
      if (!cache) {
        return cbk([400, 'ExpectedCacheForSwapDetails']);
      }

      if (!id) {
        return cbk([400, 'ExpectedIdOfSwapTransaction']);
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

    // Determine the confirmation count of a block
    getPlacement: ['validate', ({}, cbk) => {
      if (!block) {
        return cbk(null, {current_confirmation_count: 0});
      }

      return getBlockPlacement({block, cache, network, priority}, cbk);
    }],

    // Figure out what swap key index corresponds to this redeem script
    getSwapKeyIndex: ['validate', ({}, cbk) => {
      return getSwapKeyIndex({cache, network, script}, cbk);
    }],

    // Get the raw transaction
    getTransaction: ['validate', ({}, cbk) => {
      return getTransaction({block, cache, id, network}, cbk);
    }],

    // Pull out the swap keypair from the HD seed
    serverKeyPair: ['getSwapKeyIndex', ({getSwapKeyIndex}, cbk) => {
      const {index} = getSwapKeyIndex;

      if (!index) {
        return cbk([404, 'UnknownSwap']);
      }

      try {
        return cbk(null, serverSwapKeyPair({index, network}));
      } catch (err) {
        return cbk([500, 'ExpectedValidKeyPair', err]);
      }
    }],

    // Derive the swap info from the redeem script
    swapDetails: ['validate', ({}, cbk) => {
      try {
        return cbk(null, swapScriptDetails({network, script}));
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
      const currentHeight = res.getChainInfo.height;
      const refundHeight = res.swapDetails.timelock_block_height;

      const blocksUntilRefundHeight = refundHeight - currentHeight;

      if (blocksUntilRefundHeight < minBlocksUntilRefundHeight) {
        return cbk([410, 'TradeExpired']);
      }

      return cbk();
    }],

    // Get fee information
    getFeeTokens: ['invoiceDetails', ({invoiceDetails}, cbk) => {
      const to = invoiceDetails.network;
      const {tokens} = invoiceDetails;

      return getFeeForSwap({cache, network, to, tokens}, cbk);
    }],

    // Make sure that the transaction has been found
    checkTransactionDetected: ['getTransaction', ({getTransaction}, cbk) => {
      if (!getTransaction.transaction) {
        return cbk([402, 'FundingTransactionNotFound']);
      }

      return cbk();
    }],

    // Determine the number of remaining confirmations before swap execution
    remainingConfs: [
      'checkTransactionDetected',
      'getPlacement',
      ({getPlacement}, cbk) =>
    {
      const confCount = getPlacement.current_confirmation_count;

      try {
        const requiredFundingConfs = swapParameters({network}).funding_confs;

        return cbk(null, Math.max(0, requiredFundingConfs - confCount));
      } catch (err) {
        return cbk([500, 'FailedToDetermineSwapParameters', err]);
      }
    }],

    // Pending swap details
    pendingDetails: [
      'getTransaction',
      'remainingConfs',
      'swapDetails',
      ({getTransaction, remainingConfs, swapDetails}, cbk) =>
    {
      try {
        const swapUtxo = swapOutput({
          p2sh_output_script: swapDetails.p2sh_output_script,
          p2sh_p2wsh_output_script: swapDetails.p2sh_p2wsh_output_script,
          transaction: getTransaction.transaction,
          witness_output_script: swapDetails.witness_output_script,
        });

        return cbk(null, {
          conf_wait_count: remainingConfs,
          output_index: swapUtxo.output_index,
          output_tokens: swapUtxo.output_tokens,
          transaction_id: swapUtxo.transaction_id,
        });
      } catch (err) {
        return cbk([500, 'ExpectedSwapUtxoDetails', err]);
      }
    }],

    // Complete the swap transaction
    completeSwap: [
      'checkDestinationPublicKey',
      'checkTimelockHeight',
      'checkTransactionDetected',
      'getTransaction',
      'remainingConfs',
      'serverKeyPair',
      ({getTransaction, remainingConfs, serverKeyPair}, cbk) =>
    {
      // Exit early and abort swap when there are remaining confirmations
      if (remainingConfs > 0) {
        return cbk();
      }

      return completeSwapTransaction({
        cache,
        invoice,
        network,
        script,
        key: serverKeyPair.private_key,
        transaction: getTransaction.transaction,
      },
      (err, res) => {
        if (!err) {
          return cbk(null, {
            funding_utxos: res.funding_utxos,
            payment_secret: res.payment_secret,
            transaction_id: res.transaction_id,
          });
        }

        const [,error] = err;

        if (error === 'AddInvoiceError') {
          return cbk();
        }

        return cbk(err);
      });
    }],

    // Add swap to pool as necessary
    addCompletedSwap: [
      'completeSwap',
      'getSwapKeyIndex',
      'invoiceDetails',
      ({completeSwap, getSwapKeyIndex, invoiceDetails}, cbk) =>
    {
      if (!completeSwap) {
        return cbk();
      }

      const [utxo] = completeSwap.funding_utxos;

      return addDetectedSwap({
        cache,
        claim: {
          invoice,
          network,
          script,
          id: completeSwap.transaction_id,
          index: getSwapKeyIndex.index,
          outpoint: `${utxo.transaction_id}:${utxo.vout}`,
          preimage: completeSwap.payment_secret,
          type: 'claim',
        },
        id: invoiceDetails.id,
      },
      cbk);
    }],

    // Current swap status
    swapStatus: [
      'completeSwap',
      'pendingDetails',
      ({completeSwap, pendingDetails}, cbk) =>
    {
      if (!!completeSwap) {
        return cbk(null, {
          payment_secret: completeSwap.payment_secret,
          transaction_id: completeSwap.transaction_id,
        });
      } else {
        return cbk(null, {
          conf_wait_count: pendingDetails.conf_wait_count,
          output_index: pendingDetails.output_index,
          output_tokens: pendingDetails.output_tokens,
          transaction_id: pendingDetails.transaction_id,
        });
      }
    }],
  },
  returnResult({of: 'swapStatus'}, cbk));
};

