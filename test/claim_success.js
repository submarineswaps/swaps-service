const asyncAuto = require('async/auto');
const asyncConstant = require('async/constant');
const {test} = require('tap');

const macros = './macros/';

const addressForPublicKey = require(`${macros}address_for_public_key`);
const {broadcastTransaction} = require('./../chain');
const {claimTransaction} = require('./../swaps');
const {findSwapTransaction} = require('./../service');
const {generateChainBlocks, getBlockchainInfo} = require('./../chain');
const generateInvoice = require(`${macros}generate_invoice`);
const generateKeyPair = require(`${macros}generate_keypair`);
const mineTransaction = require(`${macros}mine_transaction`);
const {returnResult} = require('./../async-util');
const sendChainTokensTransaction = require(`${macros}send_chain_tokens_tx`);
const {spawnChainDaemon, stopChainDaemon} = require('./../chain');
const {swapAddress} = require('./../swaps');
const {swapScriptInTransaction} = require('./../swaps');

const chain = require('./../chain').constants;

const blockSearchDepth = 9;
const coinbaseIndex = chain.coinbase_tx_index;
const maturityBlockCount = chain.maturity_block_count;
const network = 'regtest';
const staticFeePerVirtualByte = 100;
const swapTimeoutBlockCount = 200;

/** Test a claim success script against regtest

  {
    [is_refund_to_public_key_hash]: <Is Refund to PKHash Flow Bool>
  }

  @returns via cbk
  {
    network: <Network Name String>
  }
*/
module.exports = (args, cbk) => {
  return asyncAuto({
    // Alice will make a keypair that she will use to claim her rewarded funds
    generateAliceKeyPair: cbk => generateKeyPair({network}, cbk),

    // Bob will make a keypair that he will use if Alice doesn't do the swap
    generateBobKeyPair: cbk => generateKeyPair({network}, cbk),

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
        network,
        public_key: res.generateAliceKeyPair.public_key,
      },
      cbk);
    }],

    // We'll bring up a fake chain for this test, with Bob getting the rewards
    spawnChainDaemon: ['generateBobKeyPair', ({generateBobKeyPair}, cbk) => {
      return spawnChainDaemon({
        network,
        mining_public_key: generateBobKeyPair.public_key,
      },
      cbk);
    }],

    // The chain needs to progress to maturity for Bob to spend his rewards
    generateToMaturity: ['spawnChainDaemon', (_, cbk) => {
      return generateChainBlocks({
        network,
        blocks_count: maturityBlockCount,
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
      const isPkHash = !!args.is_refund_to_public_key_hash;

      const refundPkHash = !isPkHash ? null : res.generateBobKeyPair.pk_hash;
      const refundPk = !isPkHash ? res.generateBobKeyPair.public_key : null;

      try {
        return cbk(null, swapAddress({
          destination_public_key: res.generateAliceKeyPair.public_key,
          payment_hash: res.generatePaymentPreimage.payment_hash,
          refund_public_key: refundPk,
          refund_public_key_hash: refundPkHash,
          timeout_block_height: maturityBlockCount + swapTimeoutBlockCount,
        }));
      } catch (e) {
        return cbk([0, 'ChainSwapAddrCreationFail', e]);
      }
    }],

    // Bob needs to go get a block to spend his block reward to the swap
    bobUtxo: ['generateToMaturity', ({generateToMaturity}, cbk) => {
      const [firstRewardBlock] = generateToMaturity.blocks;

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
    mineFundingTx: ['fundSwapAddress', ({fundSwapAddress}, cbk) => {
      return mineTransaction({
        network,
        transaction: fundSwapAddress.transaction,
      },
      cbk);
    }],

    // Find the funding transaction
    findFundingTransaction: [
      'generateAliceKeyPair',
      'generateBobKeyPair',
      'mineFundingTx',
      (res, cbk) =>
    {
      const isPkHash = !!args.is_refund_to_public_key_hash;

      const refundPkHash = !isPkHash ? null : res.generateBobKeyPair.pk_hash;
      const refundPk = !isPkHash ? res.generateBobKeyPair.public_key : null;

      return findSwapTransaction({
        network,
        block_search_depth: blockSearchDepth,
        destination_public_key: res.generateAliceKeyPair.public_key,
        payment_hash: res.generatePaymentPreimage.payment_hash,
        refund_public_key: refundPk,
        refund_public_key_hash: refundPkHash,
        timeout_block_height: maturityBlockCount + swapTimeoutBlockCount,
      },
      cbk);
    }],

    // Alice gets the height of the chain for her claim tx
    getHeightForSweepTransaction: ['mineFundingTx', (res, cbk) => {
      return getBlockchainInfo({network}, cbk);
    }],

    // Alice grabs the utxo she can spend to herself from the funded swap utxo
    fundingTransactionUtxos: [
      'createChainSwapAddress',
      'findFundingTransaction',
      (res, cbk) =>
    {
      if (!res.findFundingTransaction.transaction) {
        return cbk([0, 'ExpectedFundedSwapTransaction']);
      }

      try {
        return cbk(null, swapScriptInTransaction({
          redeem_script: res.createChainSwapAddress.redeem_script,
          transaction: res.findFundingTransaction.transaction,
        }));
      } catch (e) {
        return cbk([0, e.message, e]);
      }
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
        utxos: res.fundingTransactionUtxos.matching_outputs,
      });
    }],

    // Test `claim_fail_preimage` where the claim is attempted with bad preimg
    claimWithBadPreimage: ['readyToClaim', ({readyToClaim}, cbk) => {
      try {
        return cbk(null, claimTransaction({
          current_block_height: readyToClaim.current_block_height,
          destination: readyToClaim.destination,
          fee_tokens_per_vbyte: readyToClaim.fee_tokens_per_vbyte,
          preimage: readyToClaim.preimage.replace(/\d/g, '0'),
          private_key: readyToClaim.private_key,
          utxos: readyToClaim.utxos,
        }));
      } catch (e) {
        return cbk([0, 'ClaimTransactionFailed', e]);
      }
    }],

    // Make sure that using a bad preimage fails the claim tx broadcast
    confirmFailWithBadPreimage: ['claimWithBadPreimage', (res, cbk) => {
      return broadcastTransaction({
        network,
        transaction: res.claimWithBadPreimage.transaction,
      },
      err => {
        if (!err) {
          return cbk([0, 'ExpectedFailWithBadPreimage']);
        }

        return cbk();
      });
    }],

    // Test `claim_fail_sig` where the claim is attempted with a bad sig
    claimWithBobSig: ['generateBobKeyPair', 'readyToClaim', (res, cbk) => {
      try {
        return cbk(null, claimTransaction({
          current_block_height: res.readyToClaim.current_block_height,
          destination: res.readyToClaim.destination,
          fee_tokens_per_vbyte: res.readyToClaim.fee_tokens_per_vbyte,
          preimage: res.readyToClaim.preimage,
          private_key: res.generateBobKeyPair.private_key, // Wrong key
          utxos: res.readyToClaim.utxos,
        }));
      } catch (e) {
        return cbk([0, 'ExpectedClaimTransaction', e]);
      }
    }],

    // Make sure that using a bad claim signature fails the tx broadcast
    confirmFailWithBadSig: ['claimWithBobSig', (res, cbk) => {
      return broadcastTransaction({
        network: res.network,
        transaction: res.claimWithBobSig.transaction,
      },
      err => {
        if (!err) {
          return cbk([0, 'Expect fail to spend with bad sig']);
        }

        return cbk();
      });
    }],

    // Alice paid Bob's invoice so she now uses that preimage for the reward
    claimTransaction: ['readyToClaim', ({readyToClaim}, cbk) => {
      try {
        return cbk(null, claimTransaction({
          current_block_height: readyToClaim.current_block_height,
          destination: readyToClaim.destination,
          fee_tokens_per_vbyte: readyToClaim.fee_tokens_per_vbyte,
          preimage: readyToClaim.preimage,
          private_key: readyToClaim.private_key,
          utxos: readyToClaim.utxos,
        }));
      } catch (e) {
        return cbk([0, 'ExpectedClaimTransaction', e]);
      }
    }],

    // Alice's rewarded coins are confirmed back to an address she controls
    mineClaimTransaction: ['claimTransaction', ({claimTransaction}, cbk) => {
      return mineTransaction({
        network,
        transaction: claimTransaction.transaction,
      },
      cbk);
    }],
  },
  returnResult({}, cbk));
};

// Make sure that we can swap with a pkhash
test('perform swap with pkhash', t => {
  return module.exports({is_refund_to_public_key_hash: true}, testErr => {
    return stopChainDaemon({network}, stopErr => {
      if (!!stopErr || !!testErr) {
        throw new Error(testErr[1] || stopErr[1]);
      }

      return t.end();
    });
  });
});

// Make sure that we can swap with a public key
test('perform swap with public key refund', t => {
  return module.exports({}, testErr => {
    return stopChainDaemon({network}, stopErr => {
      if (!!stopErr || !!testErr) {
        throw new Error(testErr[1] || stopErr[1]);
      }

      return t.end();
    });
  });
});

