const asyncAuto = require('async/auto');
const {parseInvoice} = require('ln-service');

const macros = './../macros/';

const addressForPublicKey = require(`${macros}address_for_public_key`);
const {broadcastTransaction} = require('./../../chain');
const chain = require('./../../chain').constants;
const {claimTransaction} = require('./../../swaps');
const {generateChainBlocks} = require('./../../chain');
const generateInvoice = require(`${macros}generate_invoice`);
const {generateKeyPair} = require('./../../chain');
const {getCurrentHeight} = require('./../../chain');
const {getTransaction} = require('./../../chain');
const math = require('./../conf/math');
const mineTransaction = require(`${macros}mine_transaction`);
const promptForInput = require(`${macros}prompt`);
const {returnResult} = require('./../../async-util');
const sendChainTokensTransaction = require(`${macros}send_chain_tokens_tx`);
const {spawnChainDaemon} = require('./../macros');
const {stopChainDaemon} = require('./../../chain');
const {swapAddress} = require('./../../swaps');
const {swapScriptInTransaction} = require('./../../swaps');
const {Transaction} = require('./../../tokenslib');

const coinbaseIndex = chain.coinbase_tx_index;
const defaultNetwork = 'regtest';
const intBase = math.dec_base;
const maturityBlockCount = chain.maturity_block_count;
const timeoutBlockCount = 100;

/** Run an interactive claim success scenario.

  This test can run autonomously on regtest or interactively on testnet.

  In this scenario Alice is trading with Bob. Alice presents Bob with a payment
  hash and asks him to create a swap address.

  Bob creates the swap address and asks Alice to fund it. Alice sends tokens
  and then Bob pays the invoice and sweeps the tokens.

  This test is interactive on the Lightning invoice and the swap address. It
  does not cover any cases other than claim_success.

  {}
*/
module.exports = ({}, cbk) => {
  return asyncAuto({
    // Determine which network to run the test against
    promptForNetwork: cbk => promptForInput({
      default_value: defaultNetwork,
      explain: `Type "testnet" to run on testnet instead of ${defaultNetwork}`,
      role: 'TEST',
    },
    cbk),

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

    // Make sure the network is a known network
    network: ['promptForNetwork', (res, cbk) => {
      const network = res.promptForNetwork.value;

      if (network !== defaultNetwork && network !== 'testnet') {
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

    // Bob will need a keypair to lock coins for the success case
    generateBobKeyPair: ['network', ({network}, cbk) => {
      try {
        return cbk(null, generateKeyPair({network}));
      } catch (e) {
        return cbk([0, 'ExpectedGeneratedKeyPair', e]);
      }
    }],

    // Default sweep address for Bob to sweep claimed coins to
    defaultBobSweepAddress: ['generateBobKeyPair', 'network', (res, cbk) => {
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

    // Bring up chain daemon. Alice is paying on chain so she needs the rewards
    spawnChainDaemon: [
      'generateAliceKeyPair',
      'network',
      ({generateAliceKeyPair, network}, cbk) =>
    {
      // Exit early on testnet since a persistent daemon must be used
      if (network === 'testnet') {
        return cbk();
      }

      return spawnChainDaemon({
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

    // Determine the height at which this swap expires
    swapRefundHeight: ['getChainInfo', ({getChainInfo}, cbk) => {
      return cbk(null, getChainInfo.height + timeoutBlockCount);
    }],

    // Bob creates a chain swap address
    createChainSwapAddress: [
      'generateAliceKeyPair',
      'generateBobKeyPair',
      'network',
      'parseLightningInvoice',
      'swapRefundHeight',
      (res, cbk) =>
    {
      return cbk(null, swapAddress({
        destination_public_key: res.generateBobKeyPair.public_key,
        network: res.network,
        payment_hash: res.parseLightningInvoice.id,
        refund_public_key: res.generateAliceKeyPair.public_key,
        timeout_block_height: res.swapRefundHeight,
      }));
    }],

    // Send the tokens to the swap address
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

    // Derive the default funding transaction id that Bob will sweep
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

    // Lookup the transaction
    getFundingTransaction: ['network', 'promptForFundingTxId', (res, cbk) => {
      return getTransaction({
        id: res.promptForFundingTxId.value,
        network: res.network,
      },
      cbk);
    }],

    // Bob will need the height to lock the sweep transaction to
    getHeightForSweepTransaction: [
      'mineFundingTx',
      'network',
      'promptForFundingTxId',
      ({network}, cbk) =>
    {
      return getCurrentHeight({network}, cbk);
    }],

    // Bob needs to specify a success address where he will sweep his coins
    promptForClaimSuccessAddress: [
      'defaultBobSweepAddress',
      'getFundingTransaction',
      (res, cbk) =>
    {
      return promptForInput({
        default_value: res.defaultBobSweepAddress.p2wpkh_address,
        explain: 'Please enter an address to receive the swapped coins',
        role: 'Bob',
      },
      cbk);
    }],

    // Bob needs to check that the funding transaction pays the redeem script
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

    // Bob needs to pay the invoice and then enter the preimage
    promptForPaymentPreimage: [
      'fundingTransactionUtxos',
      'defaultLightningInvoice',
      'promptForClaimSuccessAddress',
      'promptForLightingInvoice',
      (res, cbk) =>
    {
      const invoice = res.promptForLightingInvoice.value;

      return promptForInput({
        default_value: res.defaultLightningInvoice.payment_preimage,
        explain: `Please pay ${invoice} and enter the purchased preimage`,
        role: 'Bob',
      },
      cbk);
    }],

    // Ask Bob how many tokens per vbyte in fees he'd like to pay to sweep
    promptForFees: ['promptForPaymentPreimage', (res, cbk) => {
      return promptForInput({
        default_value: '100',
        explain: 'What fee-per-vbyte rate would you like to use to sweep?',
        role: 'Bob',
      },
      cbk);
    }],

    // Tokens per vbyte
    tokensPerVirtualByte: ['promptForFees', (res, cbk) => {
      return cbk(null, parseInt(res.promptForFees.value, intBase));
    }],

    // Bob can now sweep the UTXO to his address
    claimTransaction: [
      'createChainSwapAddress',
      'generateBobKeyPair',
      'getHeightForSweepTransaction',
      'network',
      'promptForClaimSuccessAddress',
      'promptForPaymentPreimage',
      'tokensPerVirtualByte',
      (res, cbk) =>
    {
      try {
        return cbk(null, claimTransaction({
          current_block_height: res.getHeightForSweepTransaction.height,
          destination: res.promptForClaimSuccessAddress.value,
          fee_tokens_per_vbyte: res.tokensPerVirtualByte,
          network: res.network,
          preimage: res.promptForPaymentPreimage.value,
          private_key: res.generateBobKeyPair.private_key,
          redeem_script: res.createChainSwapAddress.redeem_script,
          utxos: res.fundingTransactionUtxos.matching_outputs,
        }));
      } catch (e) {
        return cbk([0, 'ClaimTransactionFailed', e]);
      }
    }],

    // Tell the network about the claim transaction
    broadcastSweepTransaction: ['claimTransaction', (res, cbk) => {
      return broadcastTransaction({
        network: res.network,
        transaction: res.claimTransaction.transaction,
      },
      cbk);
    }],

    // Mine the claim transaction into a block
    mineSweepTransaction: ['broadcastSweepTransaction', (res, cbk) => {
      // Exit early when on testnet, mining is not an option
      if (res.network === 'testnet') {
        return cbk();
      }

      return mineTransaction({
        network: res.network,
        transaction: res.claimTransaction.transaction,
      },
      cbk);
    }],
  },
  returnResult({of: 'network'}, cbk));
};

// Execute scenario
module.exports({}, (err, network) => {
  if (!!err) {
    console.log('INTERACTIVE CLAIM SUCCESS ERROR', err);
  }

  if (network !== 'testnet') {
    return stopChainDaemon({network}, err => {
      return console.log('TEST SUCCESS');
    });
  } else {
    return console.log('SUCCESSFUL TEST');
  }
});

