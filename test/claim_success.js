const asyncAuto = require('async/auto');

const macros = './macros/';
//
const addressForPublicKey = require(`${macros}address_for_public_key`);
const chainSwapAddress = require(`${macros}chain_swap_address`);
const generateChainBlocks = require(`${macros}generate_chain_blocks`);
const getBlockchainInfo = require(`${macros}get_blockchain_info`);
const generateInvoice = require(`${macros}generate_invoice`);
const generateKeyPair = require(`${macros}generate_keypair`);
const mineTransaction = require(`${macros}mine_transaction`);
const returnResult = require(`${macros}return_result`);
const sendChainTokensTransaction = require(`${macros}send_chain_tokens_tx`);
const spawnChainDaemon = require(`${macros}spawn_chain_daemon`);
const stopChainDaemon = require(`${macros}stop_chain_daemon`);
const sweepTransaction = require(`${macros}sweep_transaction`);

const coinbaseIndex = 0;
const maturityBlockCount = 100;
const swapTimeoutBlockCount = 200;

/** Test a claim success script against regtest

  {}
*/
module.exports = (args, cbk) => {
  return asyncAuto({
    // Setup a mocked up Lightning invoice preimage
    generatePaymentPreimage: cbk => generateInvoice({}, cbk),

    // Make a keypair for Alice for the claim output
    generateAliceKeyPair: cbk => generateKeyPair({}, cbk),

    // Make a keypair for Bob for the refund output
    generateBobKeyPair: cbk => generateKeyPair({}, cbk),

    // Make an address for alice to claim back her coins
    createAliceAddress: ['generateAliceKeyPair', (res, cbk) => {
      return addressForPublicKey({
        public_key: res.generateAliceKeyPair.public_key,
      },
      cbk);
    }],

    // Bring up chain daemon that we will use to test the transactions on
    spawnChainDaemon: ['generateBobKeyPair', (res, cbk) => {
      return spawnChainDaemon({
        mining_public_key: res.generateBobKeyPair.public_key,
      },
      cbk);
    }],

    // Make a bunch of blocks so that we can spend a coinbase output
    generateToMaturity: [
      'generateBobKeyPair',
      'spawnChainDaemon',
      (res, cbk) =>
    {
      return generateChainBlocks({
        blocks_count: maturityBlockCount,
        reward_public_key: res.generateBobKeyPair.public_key,
      },
      cbk);
    }],

    // Create the swap chain address
    createChainSwapAddress: [
      'generateAliceKeyPair',
      'generateBobKeyPair',
      'generatePaymentPreimage',
      (res, cbk) =>
    {
      return chainSwapAddress({
        destination_public_key: res.generateAliceKeyPair.public_key,
        payment_hash: res.generatePaymentPreimage.payment_hash,
        refund_public_key: res.generateBobKeyPair.public_key,
        timeout_block_count: swapTimeoutBlockCount,
      },
      cbk);
    }],

    // Put together Bob's UTXO to use to pay for the swap
    bobUtxo: ['generateToMaturity', (res, cbk) => {
      const [firstRewardBlock] = res.generateToMaturity.blocks;

      const [coinbaseTransaction] = firstRewardBlock.transactions;

      const [firstCoinbaseOutput] = coinbaseTransaction.outputs;

      return cbk(null, {
        tokens: firstCoinbaseOutput.tokens,
        transaction_id: coinbaseTransaction.id,
        vout: coinbaseIndex,
      });
    }],

    // Bob will send the coins to the chain swap address
    fundSwapAddress: ['bobUtxo', 'createChainSwapAddress', (res, cbk) => {
      return sendChainTokensTransaction({
        destination: res.createChainSwapAddress.p2wsh_address,
        private_key: res.generateBobKeyPair.private_key,
        spend_transaction_id: res.bobUtxo.transaction_id,
        spend_vout: res.bobUtxo.vout,
        tokens: res.bobUtxo.tokens,
      },
      cbk);
    }],

    // Mine the swap funding transaction
    mineFundingTx: ['fundSwapAddress', (res, cbk) => {
      return mineTransaction({
        block_reward_public_key: res.generateBobKeyPair.public_key,
        transaction: res.fundSwapAddress.transaction,
      },
      cbk);
    }],

    // Grab the current height to use in the sweep tx
    getHeightForSweepTransaction: ['mineFundingTx', (res, cbk) => {
      return getBlockchainInfo({}, cbk);
    }],

    // Alice will claim the tokens with the payment preimage
    sweepTransaction: [
      'bobUtxo',
      'createAliceAddress',
      'createChainSwapAddress',
      'fundSwapAddress',
      'generateAliceKeyPair',
      'generatePaymentPreimage',
      'getHeightForSweepTransaction',
      'mineFundingTx',
      (res, cbk) =>
    {
      return sweepTransaction({
        current_block_height: res.getHeightForSweepTransaction.current_height,
        destination: res.createAliceAddress.p2wpkh_address,
        preimage: res.generatePaymentPreimage.payment_preimage,
        private_key: res.generateAliceKeyPair.private_key,
        redeem_script: res.createChainSwapAddress.redeem_script_hex,
        spend_transaction: res.fundSwapAddress.transaction,
        tokens: res.bobUtxo.tokens,
      },
      cbk);
    }],

    // Mine the sweep transaction into a block
    mineSweepTransaction: ['sweepTransaction', (res, cbk) => {
      return mineTransaction({
        block_reward_public_key: res.generateBobKeyPair.public_key,
        transaction: res.sweepTransaction.transaction,
      },
      cbk);
    }],
  },
  returnResult({}, cbk));
};

module.exports({}, (err, res) => {
  if (!!err) {
    console.log('CLAIM SUCCESS ERROR', err);
  }

  stopChainDaemon({}, (err, res) => {});

  console.log('CLAIM SUCCESS TEST COMPLETE!');

  return;
});

