const asyncAuto = require('async/auto');

const {broadcastTransaction} = require('./../../chain');
const {getCurrentHeight} = require('./../../chain');
const prefixes = require('./../../tokenslib/prefixes');
const promptForInput = require('./../macros/prompt');
const {refundTransaction} = require('./../../swaps');
const {returnResult} = require('./../../async-util');
const {swapScriptDetails} = require('./../../swaps');

const decBase = 10;
const networkNames = Object.keys(prefixes);
const notFoundIndex = -1;
const tokenDivisibility = 1e8;

/** Run an interactive refund scenario given refund elements.

  {}
*/
module.exports = ({}, cbk) => {
  return asyncAuto({
    // Ask if there is a refund blob
    promptForBlob: cbk => promptForInput({
      explain: 'Refund details blob? Leave empty if absent',
    },
    cbk),

    refundDetails: ['promptForBlob', ({promptForBlob}, cbk) => {
      const {value} = promptForBlob;

      if (!value) {
        return cbk(null, {});
      }

      const details = Buffer.from(value.trim(), 'base64');

      return cbk(null, JSON.parse(details+''));
    }],

    // Determine which network to run the test against
    promptForNetwork: ['refundDetails', ({refundDetails}, cbk) => {
      if (!!refundDetails.network) {
        return cbk(null, {value: refundDetails.network});
      }

      return promptForInput({
        default_value: 'regtest',
        explain: `network? ${networkNames.join(', ')} (default: regtest)`,
      },
      cbk);
    }],

    // Make sure the network is a known network
    network: ['promptForNetwork', ({promptForNetwork}, cbk) => {
      const {value} = promptForNetwork;

      if (networkNames.indexOf(value) === notFoundIndex) {
        return cbk([400, 'ExpectedKnownNetwork', value]);
      }

      return cbk(null, value);
    }],

    // What's the current height of the chain?
    getChainHeight: ['network', ({network}, cbk) => {
      return getCurrentHeight({network}, cbk);
    }],

    // Ask the user for the redeem script (for timeout height, )
    promptForRedeem: [
      'getChainHeight',
      'refundDetails',
      ({refundDetails}, cbk) =>
    {
      if (!!refundDetails.redeem_script) {
        return cbk(null, {value: refundDetails.redeem_script});
      }

      return promptForInput({explain :'What is the redeem script?'}, cbk);
    }],

    // Redeem script
    script: ['promptForRedeem', ({promptForRedeem}, cbk) => {
      const {value} = promptForRedeem;

      if (!value) {
        return cbk([400, 'ExpectedRedeemScript']);
      }

      return cbk(null, value);
    }],

    // Check the redeem script and that the refund is possible
    scriptDetails: [
      'getChainHeight',
      'network',
      'script',
      ({getChainHeight, network, script}, cbk) =>
    {
      try {
        const current = getChainHeight.height;
        const details = swapScriptDetails({network, script});
        const refundHeight = details.timelock_block_height;

        if (current < refundHeight) {
          return cbk([400, 'RefundHeightNotReached', refundHeight, current]);
        }

        return cbk(null, details);
      } catch (err) {
        return cbk([400, 'ExpectedValidRedeemScript', err]);
      }
    }],

    // Determine if this is a pkhash or pk refund
    isPublicKeyHashRefund: ['scriptDetails', ({scriptDetails}, cbk) => {
      switch (scriptDetails.type) {
      case 'pk':
        return cbk(null, false);

      case 'pkhash':
        return cbk(null, true);

      default:
        return cbk([400, 'ExpectedKnownSwapType', scriptDetails.type]);
      }
    }],

    // Ask for swap address
    promptForAddress: [
      'refundDetails',
      'scriptDetails',
      ({refundDetails}, cbk) =>
    {
      if (!!refundDetails.swap_address) {
        return cbk(null, {value: refundDetails.swap_address});
      }

      return promptForInput({explain: 'Swap address you sent to?'}, cbk);
    }],

    // ScriptPub for swap
    scriptPub: [
      'promptForAddress',
      'scriptDetails',
      ({promptForAddress, scriptDetails}, cbk) =>
    {
      switch (promptForAddress.value) {
      case (scriptDetails.bch_p2sh_address):
      case (scriptDetails.p2sh_address):
        return cbk(null, scriptDetails.p2sh_output_script);

      case (scriptDetails.p2sh_p2wsh_address):
        return cbk(null, scriptDetails.p2sh_p2wsh_output_script);

      case (scriptDetails.p2wsh_address):
        return cbk(null, scriptDetails.witness_output_script);

      default:
        return cbk([400, 'UnrecognizedAddressForRedeemScript']);
      }
    }],

    // What transaction id funded the swap?
    promptForTxId: ['refundDetails', 'scriptPub', ({refundDetails}, cbk) => {
      if (!!refundDetails.transaction_id) {
        return cbk(null, {value: refundDetails.transaction_id});
      }

      return promptForInput({
        explain: 'What is the transaction id of the funding transaction?',
      },
      cbk);
    }],

    // Funding transaction id
    fundingTransactionId: ['promptForTxId', ({promptForTxId}, cbk) => {
      if (!promptForTxId) {
        return cbk([400, 'ExpectedFundingTransactionId']);
      }

      const {value} = promptForTxId;

      return cbk(null, value);
    }],

    // What is the output index of the swap?
    promptForTxVout: [
      'fundingTransactionId',
      'refundDetails',
      ({refundDetails}, cbk) =>
    {
      if (!!refundDetails.transaction_output_index) {
        return cbk(null, {value: refundDetails.transaction_output_index});
      }

      return promptForInput({
        explain: 'What is the index of the funding transaction output? (vout)',
      },
      cbk);
    }],

    // Funding transaction output index
    fundingTxOutputIndex: ['promptForTxVout', ({promptForTxVout}, cbk) => {
      const {value} = promptForTxVout;

      if (!value) {
        return cbk([400, 'ExpectedFundingTxVout']);
      }

      return cbk(null, parseInt(value, decBase));
    }],

    // Where should the refund be sent to?
    promptForRefund: [
      'fundingTxOutputIndex',
      'refundDetails',
      ({refundDetails}, cbk) =>
    {
      if (!!refundDetails.refund_address) {
        return cbk(null, {value: refundDetails.refund_address});
      }

      return promptForInput({
        explain: 'Please enter an address to send refunded coins to',
      },
      cbk);
    }],

    // Destination address to send refund funds to
    destination: ['promptForRefund', ({promptForRefund}, cbk) => {
      const {value} = promptForRefund;

      if (!value) {
        return cbk([400, 'ExpectedRefundDestination']);
      }

      return cbk(null, value);
    }],

    // What fee rate should be used for the refund?
    promptForFees: ['destination', 'refundDetails', ({refundDetails}, cbk) => {
      if (!!refundDetails.refund_fee_tokens_per_vbyte) {
        return cbk(null, {value: refundDetails.refund_fee_tokens_per_vbyte});
      }

      return promptForInput({
        default_value: '10',
        explain: 'What fee/vbyte to use for the refund? (default: 10)',
      },
      cbk);
    }],

    // (Parse the tokens per vbyte into a number)
    feeRate: ['promptForFees', ({promptForFees}, cbk) => {
      const {value} = promptForFees;

      if (!value) {
        return cbk([400, 'ExpectedFeePerVirtualByte']);
      }

      return cbk(null, parseInt(value, decBase));
    }],

    // Prompt for private key
    promptForPrivateKey: [
      'feeRate',
      'refundDetails',
      ({refundDetails}, cbk) =>
    {
      if (!!refundDetails.private_key) {
        return cbk(null, {value: refundDetails.private_key});
      }

      return promptForInput({explain: 'Refund Private WIF Encoded Key?'}, cbk);
    }],

    // Refund private key
    refundPrivateKey: ['promptForPrivateKey', ({promptForPrivateKey}, cbk) => {
      const {value} = promptForPrivateKey;

      if (!value) {
        return cbk([400, 'ExpectedPrivateKey']);
      }

      return cbk(null, value);
    }],

    // Prompt for tokens amount
    promptForTokens: [
      'refundDetails',
      'refundPrivateKey',
      ({refundDetails}, cbk) =>
    {
      if (!!refundDetails.swap_amount) {
        return cbk(null, {value: refundDetails.swap_amount});
      }

      return promptForInput({explain: 'Amount value sent to swap?'}, cbk);
    }],

    // Tokens sent to swap
    tokens: ['promptForTokens', ({promptForTokens}, cbk) => {
      const {value} = promptForTokens;

      if (!value) {
        return cbk([400, 'ExpectedTokensValue']);
      }

      return cbk(null, parseFloat(value, decBase) * tokenDivisibility);
    }],

    // Generate refund transaction
    refundTransaction: [
      'destination',
      'feeRate',
      'fundingTransactionId',
      'fundingTxOutputIndex',
      'getChainHeight',
      'isPublicKeyHashRefund',
      'network',
      'refundPrivateKey',
      'script',
      'scriptDetails',
      'scriptPub',
      'tokens',
      ({
        currentHeight,
        destination,
        feeRate,
        fundingTransactionId,
        fundingTxOutputIndex,
        getChainHeight,
        isPublicKeyHashRefund,
        network,
        refundPrivateKey,
        script,
        scriptDetails,
        scriptPub,
        tokens,
      },
      cbk) =>
    {
      try {
        return cbk(null, refundTransaction({
          destination,
          network,
          fee_tokens_per_vbyte: feeRate,
          is_public_key_hash_refund: isPublicKeyHashRefund,
          private_key: refundPrivateKey,
          timelock_block_height: scriptDetails.timelock_block_height,
          utxos: [{
            tokens,
            redeem: script,
            script: scriptPub,
            transaction_id: fundingTransactionId,
            vout: fundingTxOutputIndex,
          }],
        }));
      } catch (err) {
        return cbk([400, 'InvalidRefundDetails', err]);
      }
    }],

    // Send the broadast transaction out to the network
    broadcast: [
      'network',
      'refundTransaction',
      ({network, refundTransaction}, cbk) =>
    {
      const {transaction} = refundTransaction;

      console.log('BROADCAST', refundTransaction);

      return broadcastTransaction({network, transaction}, cbk);
    }],
  },
  returnResult({of: 'broadcast'}, cbk));
};

// Execute scenario
module.exports({}, (err, res) => {
  if (!!err) {
    console.log('INTERACTIVE REFUND SUCCESS ERROR', err);
  }

  return console.log('END TEST');
});

