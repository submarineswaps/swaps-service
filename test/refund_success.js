const asyncAuto = require('async/auto');
const asyncConstant = require('async/constant');
const {test} = require('tap');

const macros = './macros/';

const addressForPublicKey = require(`${macros}address_for_public_key`);
const {broadcastTransaction} = require('./../chain');
const {generateChainBlocks} = require('./../chain');
const generateInvoice = require(`${macros}generate_invoice`);
const generateKeyPair = require(`${macros}generate_keypair`);
const {getBlockchainInfo} = require('./../chain');
const mineTransaction = require(`${macros}mine_transaction`);
const {outputScriptInTransaction} = require('./../chain');
const {refundTransaction} = require('./../swaps');
const {returnResult} = require('./../async-util');
const sendChainTokensTransaction = require(`${macros}send_chain_tokens_tx`);
const {spawnChainDaemon} = require('./../chain');
const {stopChainDaemon} = require('./../chain');
const {swapAddress} = require('./../swaps');

const chain = require('./../chain').constants;

const generateDelayMs = 2;
const network = 'regtest';
const staticFeePerVirtualByte = 100;
const swapTimeoutBlocks = 25;

/** Test a refund success script against regtest

  In this test, a swap script will be generated where Alice locks funds to a
  hash plus Bob's key. But something goes wrong and Bob never claims his funds.
  Alice waits out the timeout and takes her tokens back.

  {
    is_refund_to_public_key_hash: <Is Refund to PK Hash Bool>
  }

  @returns via cbk
  {
    network: <Network Name String>
  }
*/
module.exports = (args, cbk) => {
  return asyncAuto({
    // Alice generates a keypair for her refund output.
    generateAliceKeyPair: cbk => generateKeyPair({network}, cbk),

    // Chain sync is started. Alice will get block rewards for use in deposit
    spawnChainDaemon: ['generateAliceKeyPair', (res, cbk) => {
      return spawnChainDaemon({
        network,
        mining_public_key: res.generateAliceKeyPair.public_key,
      },
      cbk);
    }],

    // Bob generates a keypair for his claim output
    generateBobKeyPair: cbk => generateKeyPair({network}, cbk),

    // Alice generates a Lightning invoice which gives a preimage/hash
    generatePaymentPreimage: ['generateAliceKeyPair', (res, cbk) => {
      return generateInvoice({
        private_key: res.generateAliceKeyPair.private_key,
      },
      cbk);
    }],

    // Alice makes an address to claim her refund
    createAliceAddress: ['generateAliceKeyPair', (res, cbk) => {
      return addressForPublicKey({
        network,
        public_key: res.generateAliceKeyPair.public_key,
      },
      cbk);
    }],

    // A bunch of blocks are made so Alice's rewards are mature
    generateToMaturity: ['spawnChainDaemon', (_, cbk) => {
      return generateChainBlocks({
        network,
        blocks_count: chain.maturity_block_count,
        delay: generateDelayMs,
      },
      cbk);
    }],

    // Get the state of the chain at maturity when Alice is ready to spend
    getMatureChainInfo: ['generateToMaturity', (_, cbk) => {
      return getBlockchainInfo({network}, cbk);
    }],

    // Determine the height at which a refund is possible
    swapRefundHeight: ['getMatureChainInfo', ({getMatureChainInfo}, cbk) => {
      return cbk(null, getMatureChainInfo.current_height + swapTimeoutBlocks);
    }],

    // A chain swap address is created. Claim: Bob. Refund: Alice.
    createChainSwapAddress: [
      'generateAliceKeyPair',
      'generateBobKeyPair',
      'generatePaymentPreimage',
      'swapRefundHeight',
      (res, cbk) =>
    {
      const isPkHash = !!args.is_refund_to_public_key_hash;

      const refundPkHash = !isPkHash ? null : res.generateAliceKeyPair.pk_hash;
      const refundPk = !isPkHash ? res.generateAliceKeyPair.public_key : null;

      try {
        return cbk(null, swapAddress({
          destination_public_key: res.generateBobKeyPair.public_key,
          payment_hash: res.generatePaymentPreimage.payment_hash,
          refund_public_key: refundPk,
          refund_public_key_hash: refundPkHash,
          timeout_block_height: res.swapRefundHeight,
        }));
      } catch (e) {
        return cbk([0, 'ExpectedChainSwapAddr', e]);
      }
    }],

    // Alice selects a UTXO to send to the swap address
    aliceUtxo: ['generateToMaturity', (res, cbk) => {
      const [firstRewardBlock] = res.generateToMaturity.blocks;

      const [coinbaseTransaction] = firstRewardBlock.transactions;

      const [firstCoinbaseOutput] = coinbaseTransaction.outputs;

      return cbk(null, {
        tokens: firstCoinbaseOutput.tokens,
        transaction_id: coinbaseTransaction.id,
        vout: chain.coinbase_tx_index,
      });
    }],

    // Alice spends the UTXO to the chain swap address
    fundSwapAddress: [
      'aliceUtxo',
      'createChainSwapAddress',
      'generateAliceKeyPair',
      (res, cbk) =>
    {
      return sendChainTokensTransaction({
        destination: res.createChainSwapAddress.p2wsh_address,
        private_key: res.generateAliceKeyPair.private_key,
        spend_transaction_id: res.aliceUtxo.transaction_id,
        spend_vout: res.aliceUtxo.vout,
        tokens: res.aliceUtxo.tokens,
      },
      cbk);
    }],

    // The swap funding transaction is mined
    mineFundingTx: ['fundSwapAddress', ({fundSwapAddress}, cbk) => {
      return mineTransaction({
        network,
        transaction: fundSwapAddress.transaction,
      },
      cbk);
    }],

    // Alice checks the height after funding
    getHeightAfterFunding: ['mineFundingTx', (_, cbk) => {
      return getBlockchainInfo({network}, cbk);
    }],

    // Alice picks up her funding utxos
    fundingTransactionUtxos: [
      'createChainSwapAddress',
      'fundSwapAddress',
      ({createChainSwapAddress, fundSwapAddress}, cbk) =>
    {
      try {
        return cbk(null, outputScriptInTransaction({
          redeem_script: createChainSwapAddress.redeem_script,
          transaction: fundSwapAddress.transaction,
        }));
      } catch (e) {
        return cbk([0, e.message, e]);
      }
    }],

    // Alice makes a transaction to claim her refund too early
    tooEarlyRefundTx: [
      'createAliceAddress',
      'fundingTransactionUtxos',
      'generateAliceKeyPair',
      'getHeightAfterFunding',
      (res, cbk) =>
    {
      try {
        return cbk(null, refundTransaction({
          current_block_height: res.getHeightAfterFunding.current_height,
          destination: res.createAliceAddress.p2wpkh_address,
          fee_tokens_per_vbyte: staticFeePerVirtualByte,
          is_public_key_hash_refund: args.is_refund_to_public_key_hash,
          private_key: res.generateAliceKeyPair.private_key,
          utxos: res.fundingTransactionUtxos.matching_outputs,
        }));
      } catch (e) {
        return cbk([0, 'ExpectedRefundTx', e]);
      }
    }],

    // Alice tries to claim her refund right away but hits `refund_too_early`
    broadcastEarlyRefundTx: ['tooEarlyRefundTx', (res, cbk) => {
      return broadcastTransaction({
        network,
        transaction: res.tooEarlyRefundTx.transaction,
      },
      err => {
        if (!err) {
          return cbk([0, 'ExpectedTxFailsCltvCheck']);
        }

        return cbk();
      });
    }],

    // Bob never gets the preimage and claims his funds. Many blocks go by
    generateTimeoutBlocks: ['mineFundingTx', (_, cbk) => {
      return generateChainBlocks({
        network,
        blocks_count: swapTimeoutBlocks,
      },
      cbk);
    }],

    // Grab the current height to use in the sweep tx
    getHeightForRefund: ['generateTimeoutBlocks', (_, cbk) => {
      return getBlockchainInfo({network}, cbk);
    }],

    // Alice will claim her refunded tokens after the timeout
    sweepTransaction: [
      'createAliceAddress',
      'createChainSwapAddress',
      'fundingTransactionUtxos',
      'generateAliceKeyPair',
      'getHeightForRefund',
      'mineFundingTx',
      (res, cbk) =>
    {
      try {
        cbk(null, refundTransaction({
          current_block_height: res.getHeightForRefund.current_height,
          destination: res.createAliceAddress.p2wpkh_address,
          fee_tokens_per_vbyte: staticFeePerVirtualByte,
          is_public_key_hash_refund: args.is_refund_to_public_key_hash,
          private_key: res.generateAliceKeyPair.private_key,
          utxos: res.fundingTransactionUtxos.matching_outputs,
        }));
      } catch (e) {
        return cbk([0, 'ExpectedRefundTx', e]);
      }
    }],

    // Mine the sweep transaction into a block
    mineSweepTransaction: ['sweepTransaction', ({sweepTransaction}, cbk) => {
      return mineTransaction({
        network,
        transaction: sweepTransaction.transaction,
      },
      cbk);
    }],
  },
  returnResult({}, cbk));
};

test('perform swap and refund with a pkhash', t => {
  return module.exports({is_refund_to_public_key_hash: true}, testErr => {
    return stopChainDaemon({network}, stopErr => {
      if (!!stopErr || !!testErr) {
        throw new Error(testErr[1] || stopErr[1]);
      }

      return t.end();
    });
  });
});

test('perform swap and refund with refund key', t => {
  return module.exports({}, testErr => {
    return stopChainDaemon({network}, stopErr => {
      if (!!stopErr || !!testErr) {
        throw new Error(testErr[1] || stopErr[1]);
      }

      return t.end();
    });
  });
});

