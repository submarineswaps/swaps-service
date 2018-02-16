const asyncAuto = require('async/auto');
const {Transaction} = require('bitcoinjs-lib');

const macros = './../macros/';

const addressForPublicKey = require(`${macros}address_for_public_key`);
const broadcastTransaction = require(`${macros}broadcast_transaction`);
const chainSwapAddress = require(`${macros}chain_swap_address`);
const generateInvoice = require(`${macros}generate_invoice`);
const generateKeyPair = require(`${macros}generate_keypair`);
const generateChainBlocks = require(`${macros}generate_chain_blocks`);
const getBlockchainInfo = require(`${macros}get_blockchain_info`);
const getTransaction = require(`${macros}get_transaction`);
const mineTransaction = require(`${macros}mine_transaction`);
const outputScriptInTransaction = require(`${macros}output_script_in_tx`);
const parseLightningInvoice = require(`${macros}parse_lightning_invoice`);
const promptForInput = require(`${macros}prompt`);
const returnResult = require(`${macros}return_result`);
const sendChainTokensTransaction = require(`${macros}send_chain_tokens_tx`);
const spawnChainDaemon = require(`${macros}spawn_chain_daemon`);
const stopChainDaemon = require(`${macros}stop_chain_daemon`);
const sweepTransaction = require(`${macros}sweep_transaction`);

const coinbaseIndex = 0;
const intBase = 10;
const maturityBlockCount = 300;
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
module.exports = (args, cbk) => {
  return asyncAuto({
    // Alice will need a new keypair to get back refunded coins
    generateAliceKeyPair: cbk => generateKeyPair({}, cbk),

    // Bob will need a keypair to lock coins for the success case
    generateBobKeyPair: cbk => generateKeyPair({}, cbk),

    // Determine which network to run the test against
    promptForNetwork: cbk => promptForInput({
      default_value: 'regtest',
      explain: 'Type "testnet" to run test on testnet instead of regtest',
      role: 'TEST',
    },
    cbk),

    // In a default case we can assume Alice made the invoice herself
    defaultLightningInvoice: ['generateAliceKeyPair', (res, cbk) => {
      return generateInvoice({
        private_key: res.generateAliceKeyPair.private_key,
      },
      cbk);
    }],

    // Default sweep address for Bob to sweep claimed coins to
    defaultBobSweepAddress: ['generateBobKeyPair', (res, cbk) => {
      return addressForPublicKey({
        public_key: res.generateBobKeyPair.public_key,
      },
      cbk);
    }],

    // Make sure the network is a known network
    network: ['promptForNetwork', (res, cbk) => {
      const network = res.promptForNetwork.value;

      if (network !== 'regtest' && network !== 'testnet') {
        return cbk([0, 'Expected known network']);
      }

      return cbk(null, network);
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
    spawnChainDaemon: ['generateAliceKeyPair','network', (res, cbk) => {
      // Exit early on testnet since a persistent daemon must be used
      if (res.network === 'testnet') {
        return cbk();
      }

      return spawnChainDaemon({
        mining_public_key: res.generateAliceKeyPair.public_key,
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
        blocks_count: maturityBlockCount,
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
    getChainInfo: ['generateToMaturity', 'network', (res, cbk) => {
      return getBlockchainInfo({network: res.network}, cbk);
    }],

    // Bob needs to parse the invoice to find the hash to lock the swap to
    parseLightningInvoice: ['promptForLightingInvoice', (res, cbk) => {
      return parseLightningInvoice({
        invoice: res.promptForLightingInvoice.value,
      },
      cbk);
    }],

    // Bob creates a chain swap address
    createChainSwapAddress: [
      'generateAliceKeyPair',
      'generateBobKeyPair',
      'getChainInfo',
      'parseLightningInvoice',
      (res, cbk) =>
    {
      return chainSwapAddress({
        destination_public_key: res.generateBobKeyPair.public_key,
        payment_hash: res.parseLightningInvoice.payment_hash,
        refund_public_key: res.generateAliceKeyPair.public_key,
        timeout_block_count: res.getChainInfo.current_height+timeoutBlockCount,
      },
      cbk);
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
        network: res.network,
        transaction_id: res.promptForFundingTxId.value,
      },
      cbk);
    }],

    // Bob will need the height to lock the sweep transaction to
    getHeightForSweepTransaction: [
      'mineFundingTx',
      'promptForFundingTxId',
      (res, cbk) =>
    {
      return getBlockchainInfo({network: res.network}, cbk);
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
      return outputScriptInTransaction({
        redeem_script: res.createChainSwapAddress.redeem_script,
        transaction: res.getFundingTransaction.transaction,
      },
      cbk);
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
    sweepTransaction: [
      'createChainSwapAddress',
      'generateBobKeyPair',
      'getHeightForSweepTransaction',
      'promptForClaimSuccessAddress',
      'promptForPaymentPreimage',
      'tokensPerVirtualByte',
      (res, cbk) =>
    {
      return sweepTransaction({
        current_block_height: res.getHeightForSweepTransaction.current_height,
        destination: res.promptForClaimSuccessAddress.value,
        fee_tokens_per_vbyte: res.tokensPerVirtualByte,
        preimage: res.promptForPaymentPreimage.value,
        private_key: res.generateBobKeyPair.private_key,
        redeem_script: res.createChainSwapAddress.redeem_script,
        utxos: res.fundingTransactionUtxos.matching_outputs,
      },
      cbk);
    }],

    broadcastSweepTransaction: ['sweepTransaction', (res, cbk) => {
      return broadcastTransaction({
        network: res.network,
        transaction: res.sweepTransaction.transaction,
      },
      cbk);
    }],

    mineSweepTransaction: ['broadcastSweepTransaction', (res, cbk) => {
      // Exit early when on testnet, mining is not an option
      if (res.network === 'testnet') {
        return cbk();
      }

      return mineTransaction({
        network: res.network,
        transaction: res.sweepTransaction.transaction,
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
    return stopChainDaemon({network}, (err) => {
      return console.log('TEST END');
    });
  } else {
    return console.log('END TEST');
  }
});

