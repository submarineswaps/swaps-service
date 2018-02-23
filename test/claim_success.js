const asyncAuto = require('async/auto');
const asyncConstant = require('async/constant');

const macros = './macros/';

const addressForPublicKey = require(`${macros}address_for_public_key`);
const broadcastTransaction = require(`${macros}broadcast_transaction`);
const chainSwapAddress = require(`${macros}chain_swap_address`);
const claimTransaction = require(`${macros}claim_transaction`);
const generateChainBlocks = require(`${macros}generate_chain_blocks`);
const getBlockchainInfo = require(`${macros}get_blockchain_info`);
const generateInvoice = require(`${macros}generate_invoice`);
const generateKeyPair = require(`${macros}generate_keypair`);
const mineTransaction = require(`${macros}mine_transaction`);
const outputScriptInTransaction = require(`${macros}output_script_in_tx`);
const returnResult = require(`${macros}return_result`);
const sendChainTokensTransaction = require(`${macros}send_chain_tokens_tx`);
const spawnChainDaemon = require(`${macros}spawn_chain_daemon`);
const stopChainDaemon = require(`${macros}stop_chain_daemon`);

const chain = require('./conf/chain');
const errCode = require('./conf/error_codes');

const coinbaseIndex = chain.coinbase_tx_index;
const maturityBlockCount = chain.maturity_block_count;
const staticFeePerVirtualByte = 100;
const swapTimeoutBlockCount = 200;

/** Test a claim success script against regtest

  {}

  @returns via cbk
  {
    network: <Network Name String>
  }
*/
module.exports = (args, cbk) => {
  return asyncAuto({
    // We're going to use regtest for this test
    network: asyncConstant('regtest'),

    // Alice will make a keypair that she will use to claim her rewarded funds
    generateAliceKeyPair: ['network', ({network}, cbk) => {
      return generateKeyPair({network}, cbk);
    }],

    // Bob will make a keypair that he will use if Alice doesn't do the swap
    generateBobKeyPair: ['network', ({network}, cbk) => {
      return generateKeyPair({network}, cbk);
    }],

    // Bob will make a Lightning invoice to pay
    generatePaymentPreimage: ['generateBobKeyPair', (res, cbk) => {
      return generateInvoice({
        private_key: res.generateBobKeyPair.private_key,
      },
      cbk);
    }],

    // Alice makes an address she will use to sweep out her coins to later
    createAliceAddress: ['generateAliceKeyPair', (res, cbk) => {
      return addressForPublicKey({
        network: res.network,
        public_key: res.generateAliceKeyPair.public_key,
      },
      cbk);
    }],

    // We'll bring up a fake chain for this test, with Bob getting the rewards
    spawnChainDaemon: ['generateBobKeyPair', (res, cbk) => {
      return spawnChainDaemon({
        mining_public_key: res.generateBobKeyPair.public_key,
        network: res.network,
      },
      cbk);
    }],

    // The chain needs to progress to maturity for Bob to spend his rewards
    generateToMaturity: ['network', 'spawnChainDaemon', (res, cbk) => {
      return generateChainBlocks({
        blocks_count: maturityBlockCount,
        network: res.network,
      },
      cbk);
    }],

    // Bob creates a swap address that pays out to Alice or back to him on fail
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
        timeout_block_height: maturityBlockCount + swapTimeoutBlockCount,
      },
      cbk);
    }],

    // Bob needs to go get a block to spend his block reward to the swap
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

    // Bob makes a send transaction to fund the swap with his coins
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

    // The chain progresses and confirms the swap funding
    mineFundingTx: ['fundSwapAddress', (res, cbk) => {
      return mineTransaction({
        network: res.network,
        transaction: res.fundSwapAddress.transaction,
      },
      cbk);
    }],

    // Alice gets the height of the chain for her claim tx
    getHeightForSweepTransaction: ['mineFundingTx', (res, cbk) => {
      return getBlockchainInfo({network: res.network}, cbk);
    }],

    // Alice grabs the utxo she can spend to herself from the funded swap utxo
    fundingTransactionUtxos: [
      'createChainSwapAddress',
      'fundSwapAddress',
      (res, cbk) =>
    {
      return outputScriptInTransaction({
        redeem_script: res.createChainSwapAddress.redeem_script,
        transaction: res.fundSwapAddress.transaction,
      },
      cbk);
    }],

    // Make sure that we are ready to claim
    readyToClaim: [
      'createAliceAddress', // Got an address to sweep claimed funds to
      'fundingTransactionUtxos', // Figured out which utxos are swap ones
      'getHeightForSweepTransaction', // Got a good locktime for the sweep tx
      (res, cbk) =>
    {
      return cbk(null, {
        current_block_height: res.getHeightForSweepTransaction.current_height,
        destination: res.createAliceAddress.p2wpkh_address,
        fee_tokens_per_vbyte: staticFeePerVirtualByte,
        preimage: res.generatePaymentPreimage.payment_preimage,
        private_key: res.generateAliceKeyPair.private_key,
        redeem_script: res.createChainSwapAddress.redeem_script,
        utxos: res.fundingTransactionUtxos.matching_outputs,
      });
    }],

    // Test `claim_fail_preimage` where the claim is attempted with bad preimg
    claimWithBadPreimage: ['readyToClaim', ({readyToClaim}, cbk) => {
      return claimTransaction({
        current_block_height: readyToClaim.current_block_height,
        destination: readyToClaim.destination,
        fee_tokens_per_vbyte: readyToClaim.fee_tokens_per_vbyte,
        preimage: readyToClaim.preimage.replace(/\d/g, '0'),
        private_key: readyToClaim.private_key,
        redeem_script: readyToClaim.redeem_script,
        utxos: readyToClaim.utxos,
      },
      cbk);
    }],

    // Make sure that using a bad preimage fails the claim tx broadcast
    confirmFailWithBadPreimage: ['claimWithBadPreimage', (res, cbk) => {
      return broadcastTransaction({
        network: res.network,
        transaction: res.claimWithBadPreimage.transaction,
      },
      err => {
        if (!err) {
          return cbk([errCode.local_err, 'Expected fail with bad preimage']);
        }

        return cbk();
      });
    }],

    // Test `claim_fail_sig` where the claim is attempted with a bad sig
    claimWithBobSig: ['generateBobKeyPair', 'readyToClaim', (res, cbk) => {
      return claimTransaction({
        current_block_height: res.readyToClaim.current_block_height,
        destination: res.readyToClaim.destination,
        fee_tokens_per_vbyte: res.readyToClaim.fee_tokens_per_vbyte,
        preimage: res.readyToClaim.preimage,
        private_key: res.generateBobKeyPair.private_key, // Using the wrong key
        redeem_script: res.readyToClaim.redeem_script,
        utxos: res.readyToClaim.utxos,
      },
      cbk);
    }],

    // Make sure that using a bad claim signature fails the tx broadcast
    confirmFailWithBadSig: ['claimWithBobSig', (res, cbk) => {
      return broadcastTransaction({
        network: res.network,
        transaction: res.claimWithBobSig.transaction,
      },
      err => {
        if (!err) {
          return cbk([errCode.local_err, 'Expect fail to spend with bad sig']);
        }

        return cbk();
      });
    }],

    // Alice paid Bob's invoice so she now uses that preimage for the reward
    claimTransaction: ['readyToClaim', ({readyToClaim}, cbk) => {
      return claimTransaction({
        current_block_height: readyToClaim.current_block_height,
        destination: readyToClaim.destination,
        fee_tokens_per_vbyte: readyToClaim.fee_tokens_per_vbyte,
        preimage: readyToClaim.preimage,
        private_key: readyToClaim.private_key,
        redeem_script: readyToClaim.redeem_script,
        utxos: readyToClaim.utxos,
      },
      cbk);
    }],

    // Alice's rewarded coins are confirmed back to an address she controls
    mineClaimTransaction: ['claimTransaction', (res, cbk) => {
      return mineTransaction({
        network: res.network,
        transaction: res.claimTransaction.transaction,
      },
      cbk);
    }],
  },
  returnResult({of: 'network'}, cbk));
};

module.exports({}, (err, network) => {
  if (!!err) {
    console.log('CLAIM SUCCESS ERROR', err);
  }

  stopChainDaemon({network}, (err, res) => {});

  console.log('CLAIM SUCCESS TEST COMPLETE!');

  return;
});

