const asyncAuto = require('async/auto');
const asyncDuring = require('async/during');
const ora = require('ora');
const {parseInvoice} = require('ln-service');

const macros = './../macros/';

const addressForPublicKey = require(`${macros}address_for_public_key`);
const {broadcastTransaction} = require('./../../chain');
const chain = require('./../../chain').constants;
const {generateChainBlocks} = require('./../../chain');
const generateInvoice = require(`${macros}generate_invoice`);
const {generateKeyPair} = require('./../../chain');
const {getCurrentHeight} = require('./../../chain');
const {getTransaction} = require('./../../chain');
const isChainBelowHeight = require(`${macros}is_chain_below_height`);
const math = require('./../conf/math');
const mineTransaction = require(`${macros}mine_transaction`);
const promptForInput = require(`${macros}prompt`);
const {refundTransaction} = require('./../../swaps');
const {returnResult} = require('./../../async-util');
const sendChainTokensTransaction = require(`${macros}send_chain_tokens_tx`);
const {spawnChainDaemon} = require('./../macros');
const {stopChainDaemon} = require('./../../chain');
const {swapAddress} = require('./../../swaps');
const {swapScriptInTransaction} = require('./../../swaps');
const {Transaction} = require('./../../tokenslib');

const chainCheckFrequencyMs = 200;
const coinbaseIndex = chain.coinbase_tx_index;
const intBase = math.dec_base;
const maturityBlockCount = chain.maturity_block_count;
const simulatedBlockDelayMs = 300;
const timeoutBlockCount = 9;

/** Run an interactive refund success scenario.

  This test can run autonomously on regtest or interactively on testnet.

  In this scenario Alice is trading with Bob. Alice presents Bob with a payment
  hash and asks him to create a swap address.

  Bob creates the swap address and asks Alice to fund it. Alice sends tokens
  but Bob doesn't pay the invoice so Alice takes her funds back after a delay.

  This test is interactive on the Lightning invoice and the swap address. It
  does not cover any cases other than refund_success.

  {}
*/
module.exports = ({}, cbk) => {
  return asyncAuto({
    // Determine which network to run the test against
    promptForNetwork: cbk => promptForInput({
      default_value: 'regtest',
      explain: 'Type "testnet" to run test on testnet instead of regtest',
      role: 'TEST',
    },
    cbk),

    // Make sure the network is a known network
    network: ['promptForNetwork', (res, cbk) => {
      const network = res.promptForNetwork.value;

      if (network !== 'regtest' && network !== 'testnet') {
        return cbk([0, 'ExpectedKnownNetwork']);
      }

      return cbk(null, network);
    }],

    // Alice will need a new keypair to get back refunded coins
    generateAliceKeyPair: ['network', ({network}, cbk) => {
      try {
        return cbk(null, generateKeyPair({network}));
      } catch (e) {
        return cbk([0, 'ExpectedGeneratedKeyPair', e]);
      }
    }],

    // In a default case we can assume Alice made the invoice herself
    defaultLightningInvoice: [
      'generateAliceKeyPair',
      'network',
      ({generateAliceKeyPair, network}, cbk) =>
    {
      return generateInvoice({
        network,
        private_key: generateAliceKeyPair.private_key,
      },
      cbk);
    }],

    // Bob will need a keypair to lock coins for the success case
    generateBobKeyPair: ['network', ({network}, cbk) => {
      try {
        return cbk(null, generateKeyPair({network}));
      } catch (e) {
        return cbk([0, 'ExpectedGeneratedKeyPair', e]);
      }
    }],

    // Default refund address for Alice to get her coins sent back to
    defaultAliceRefundAddress: [
      'generateAliceKeyPair',
      'network',
      (res, cbk) =>
    {
      return addressForPublicKey({
        network: res.network,
        public_key: res.generateBobKeyPair.public_key,
      },
      cbk);
    }],

    // Alice needs to give a payment hash in order to get this started
    promptForLightingInvoice: [
      'defaultLightningInvoice',
      'network',
      ({defaultLightningInvoice}, cbk) =>
    {
      return promptForInput({
        default_value: defaultLightningInvoice.invoice,
        explain: 'Please enter a bolt11 encoded Lightning invoice',
        role: 'Alice',
      },
      cbk);
    }],

    // Bring up chain daemon. Alice is paying on chain so she is the miner
    spawnChainDaemon: [
      'generateAliceKeyPair',
      'network',
      ({generateAliceKeyPair, network}, cbk) =>
    {
      // Exit early on testnet since a persistent daemon must be used
      if (network === 'testnet') {
        return cbk();
      }

      return spawnChainDa1emon({
        network,
        daemon: 'btcd',
        mining_public_key: generateAliceKeyPair.public_key,
      },
      cbk);
    }],

    // Make a bunch of blocks so that Alice can spend a coinbase output
    generateToMaturity: ['network', 'spawnChainDaemon', (res, cbk) => {
      // Exit early on testnet since blocks can't be generated
      if (res.network === 'testnet') {
        return cbk();
      }

      return generateChainBlocks({
        count: maturityBlockCount,
        network: res.network,
      },
      cbk);
    }],

    // Put together Alice's UTXO to use to pay for the swap
    aliceUtxo: ['generateToMaturity', (res, cbk) => {
      // Exit early on testnet where the funds are handled separately
      if (res.network === 'testnet') {
        return cbk();
      }

      const [firstRewardBlock] = res.generateToMaturity.blocks;

      const [coinbaseTransaction] = firstRewardBlock.transactions;

      const [firstCoinbaseOutput] = coinbaseTransaction.outputs;

      return cbk(null, {
        tokens: firstCoinbaseOutput.tokens,
        transaction_id: coinbaseTransaction.id,
        vout: coinbaseIndex,
      });
    }],

    // Bob needs the current block height to determine a swap timeout
    getChainInfo: ['generateToMaturity', 'network', ({network}, cbk) => {
      return getCurrentHeight({network}, cbk);
    }],

    // Bob needs to parse the invoice to find the hash to lock the swap to
    parseLightningInvoice: ['promptForLightingInvoice', (res, cbk) => {
      try {
        return parseInvoice({invoice: res.promptForLightingInvoice.value});
      } catch (e) {
        return cbk([0, 'ExpectedValidInvoice', e]);
      }
    }],

    // Determine the timeout block height
    timeoutBlockHeight: ['getChainInfo', ({getChainInfo}, cbk) => {
      return cbk(null, getChainInfo.height + timeoutBlockCount);
    }],

    // Bob creates a chain swap address. Refund pays to Alice.
    createChainSwapAddress: [
      'generateAliceKeyPair',
      'generateBobKeyPair',
      'network',
      'parseLightningInvoice',
      'timeoutBlockHeight',
      (res, cbk) =>
    {
      return cbk(null, swapAddress({
        destination_public_key: res.generateBobKeyPair.public_key,
        network: res.network,
        payment_hash: res.parseLightningInvoice.id,
        refund_public_key: res.generateAliceKeyPair.public_key,
        timeout_block_height: res.timeoutBlockHeight,
      }));
    }],

    // Alice creates a transaction that sends tokens to the swap address
    fundingTx: [
      'aliceUtxo',
      'createChainSwapAddress',
      'generateAliceKeyPair',
      (res, cbk) =>
    {
      // Exit early on testnet when the funding tx will happen outside
      if (res.network === 'testnet') {
        return cbk();
      }

      return sendChainTokensTransaction({
        destination: res.createChainSwapAddress.p2wsh_address,
        network: res.network,
        private_key: res.generateAliceKeyPair.private_key,
        spend_transaction_id: res.aliceUtxo.transaction_id,
        spend_vout: res.aliceUtxo.vout,
        tokens: res.aliceUtxo.tokens,
      },
      cbk);
    }],

    // Derive the default funding transaction id
    defaultFundingTxId: ['fundingTx', (res, cbk) => {
      // Exit early on testnet since funding tx id must be user supplied
      if (res.network === 'testnet') {
        return cbk();
      }

      return cbk(null, Transaction.fromHex(res.fundingTx.transaction).getId());
    }],

    // Mine the swap funding transaction
    mineFundingTx: ['fundingTx', 'network', ({fundingTx, network}, cbk) => {
      // Exit early when on testnet, mining is not an option
      if (network === 'testnet') {
        return cbk();
      }

      const {transaction} = fundingTx;

      return mineTransaction({network, transaction}, cbk);
    }],

    // Alice needs to send coins to an address and enter a UTXO
    promptForFundingTxId: [
      'createChainSwapAddress',
      'defaultFundingTxId',
      (res, cbk) =>
    {
      const fundingAddr = res.createChainSwapAddress.p2wsh_address;

      return promptForInput({
        default_value: res.defaultFundingTxId,
        explain: `Please deposit tokens to ${fundingAddr} and specify tx id`,
        role: 'Alice',
      },
      cbk);
    }],

    // The refund will take a while to be possible, show wait indicator
    startWaitingIndicator: ['promptForFundingTxId', (res, cbk) => {
      const indicator = ora({
        spinner: 'weather',
        text: 'Waiting for refund timeout...',
      });

      return cbk(null, indicator.start());
    }],

    // Lookup the transaction, Alice will use this tx to get her refund
    getFundingTransaction: ['network', 'promptForFundingTxId', (res, cbk) => {
      return getTransaction({
        id: res.promptForFundingTxId.value,
        network: res.network,
      },
      cbk);
    }],

    // Now that the funding tx is known, fast forward time to the refund height
    generateBlocksToHeight: ['promptForFundingTxId', ({network}, cbk) => {
      // Exit early when the network is one where we can't make blocks
      if (network === 'testnet') {
        return cbk();
      }

      return generateChainBlocks({
        network,
        count: timeoutBlockCount,
        delay: simulatedBlockDelayMs,
      },
      cbk);
    }],

    // Alice waits to be able to refund the funds back to herself
    waitForRefundReadiness: [
      'promptForFundingTxId',
      'timeoutBlockHeight',
      ({network, timeoutBlockHeight}, cbk) =>
    {
      return asyncDuring(
        cbk => isChainBelowHeight({network, height: timeoutBlockHeight}, cbk),
        cbk => setTimeout(cbk, chainCheckFrequencyMs),
        cbk
      );
    }],

    // Alice needs to specify a refund address where to get back her coins
    promptForRefundAddress: [
      'defaultAliceRefundAddress',
      'generateBlocksToHeight',
      'getFundingTransaction',
      'startWaitingIndicator',
      'waitForRefundReadiness',
      (res, cbk) =>
    {
      return res.startWaitingIndicator.stop() && promptForInput({
        default_value: res.defaultAliceRefundAddress.p2wpkh_address,
        explain: 'Please enter an address to receive the refunded coins',
        role: 'Alice',
      },
      cbk);
    }],

    // Ask Alice how many tokens per vbyte in fees to use for the refund sweep
    promptForFees: ['promptForRefundAddress', (res, cbk) => {
      return promptForInput({
        default_value: '100',
        explain: 'What fee-per-vbyte rate do you want to use for the refund?',
        role: 'Alice',
      },
      cbk);
    }],

    // Alice will need the height to lock the refund transaction to
    getHeightForRefundTransaction: [
      'mineFundingTx',
      'network',
      'promptForFees',
      ({network}, cbk) =>
    {
      return getCurrentHeight({network}, cbk);
    }],

    // Alice needs to grab the utxo to get her refund
    fundingTransactionUtxos: [
      'createChainSwapAddress',
      'getFundingTransaction',
      (res, cbk) =>
    {
      try {
        return cbk(null, swapScriptInTransaction({
          redeem_script: res.createChainSwapAddress.redeem_script,
          transaction: res.getFundingTransaction.transaction,
        }));
      } catch (e) {
        return cbk([0, e.message, e]);
      }
    }],

    // (Parse the tokens per vbyte into a number)
    tokensPerVirtualByte: ['promptForFees', (res, cbk) => {
      return cbk(null, parseInt(res.promptForFees.value, intBase));
    }],

    // Alice can now reclaim the transaction back to her address
    refundTransaction: [
      'createChainSwapAddress',
      'fundingTransactionUtxos',
      'generateAliceKeyPair',
      'getHeightForRefundTransaction',
      'network',
      'promptForRefundAddress',
      'tokensPerVirtualByte',
      (res, cbk) =>
    {
      return refundTransaction({
        destination: res.promptForRefundAddress.value,
        fee_tokens_per_vbyte: res.tokensPerVirtualByte,
        network: res.network,
        private_key: res.generateAliceKeyPair.private_key,
        redeem_script: res.createChainSwapAddress.redeem_script,
        timelock_block_height: res.getHeightForRefundTransaction.height,
        utxos: res.fundingTransactionUtxos.matching_outputs,
      },
      cbk);
    }],

    // Send the broadast transaction out to the network
    broadcastRefundTransaction: ['refundTransaction', (res, cbk) => {
      return broadcastTransaction({
        network: res.network,
        transaction: res.refundTransaction.transaction,
      },
      cbk);
    }],

    // Confirm the refund transaction sending the funds back to Alice
    mineRefundTransaction: ['broadcastRefundTransaction', (res, cbk) => {
      // Exit early when on testnet, mining is not an option
      if (res.network === 'testnet') {
        return cbk();
      }

      return mineTransaction({
        network: res.network,
        transaction: res.refundTransaction.transaction,
      },
      cbk);
    }],
  },
  returnResult({of: 'network'}, cbk));
};

// Execute scenario
module.exports({}, (err, network) => {
  if (!!err) {
    console.log('INTERACTIVE REFUND SUCCESS ERROR', err);
  }

  if (network !== 'testnet') {
    return stopChainDaemon({network}, (err) => {
      return console.log('TEST END');
    });
  } else {
    return console.log('END TEST');
  }
});

