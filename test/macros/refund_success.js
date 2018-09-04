const asyncAuto = require('async/auto');

const addressForPublicKey = require('./address_for_public_key');
const {broadcastTransaction} = require('./../../chain');
const {clearCache} = require('./../../cache');
const {chainConstants} = require('./../../chain');
const {createRefundPsbt} = require('./../../swaps');
const {ECPair} = require('./../../tokenslib');
const generateChainBlocks = require('./generate_chain_blocks');
const generateInvoice = require('./generate_invoice');
const {generateKeyPair} = require('./../../chain');
const {getCurrentHeight} = require('./../../chain');
const mineTransaction = require('./mine_transaction');
const {networks} = require('./../../tokenslib');
const {payments} = require('./../../tokenslib');
const {refundTransaction} = require('./../../swaps');
const sendChainTokensTransaction = require('./send_chain_tokens_tx');
const {signRefundPsbt} = require('./../../swaps');
const spawnChainDaemon = require('./spawn_chain_daemon');
const spawnLnd = require('./spawn_lnd');
const {stopChainDaemon} = require('./../../chain');
const {swapAddress} = require('./../../swaps');
const {swapScriptInTransaction} = require('./../../swaps');

const {fromPublicKey} = ECPair;
const generateDelayMs = 2;
const {p2pkh} = payments;
const staticFeePerVirtualByte = 100;
const swapTimeoutBlocks = 25;

/** Test a refund success script against regtest

  In this test, a swap script will be generated where Alice locks funds to a
  hash plus Bob's key. But something goes wrong and Bob never claims his funds.
  Alice waits out the timeout and takes her tokens back.

  {
    daemon: <Daemon Type String>
    network: <Network Name String>
    [is_refund_to_public_key_hash]: <Is Refund to PK Hash Bool> = false
    swap_type: <Swap Type String>
  }
*/
module.exports = (args, cbk) => {
  return asyncAuto({
    // Alice generates a keypair for her refund output.
    generateAliceKeyPair: cbk => {
      try {
        return cbk(null, generateKeyPair({network: args.network}));
      } catch (err) {
        return cbk([500, 'ExpectedGeneratedKeyPair', err]);
      }
    },

    // Create a dummy LND
    spawnLnd: cbk => spawnLnd({}, cbk),

    // Chain sync is started. Alice will get block rewards for use in deposit
    spawnChainDaemon: ['generateAliceKeyPair', (res, cbk) => {
      return spawnChainDaemon({
        daemon: args.daemon,
        network: args.network,
        mining_public_key: res.generateAliceKeyPair.public_key,
      },
      cbk);
    }],

    // Determine mine-to-address
    mineToAddress: ['generateAliceKeyPair', ({generateAliceKeyPair}, cbk) => {
      switch (args.daemon) {
      case 'bcash':
      case 'bcoin':
      case "bitcoind":
        const aliceKey = Buffer.from(generateAliceKeyPair.public_key, 'hex');
        const network = networks[args.network];

        const pubkey = fromPublicKey(aliceKey, network).publicKey;

        return cbk(null, p2pkh({network, pubkey}).address);

      case 'btcd':
      case 'ltcd':
        return cbk();

      default:
        return cbk([400, 'UnexpectedDaemonForGeneration', args.daemon]);
      }
    }],

    // Bob generates a keypair for his claim output
    generateBobKeyPair: cbk => {
      try {
        return cbk(null, generateKeyPair({network: args.network}));
      } catch (e) {
        return cbk([0, 'ExpectedGeneratedKeyPair', e]);
      }
    },

    // Alice generates a Lightning invoice which gives a preimage/hash
    generatePaymentPreimage: ['spawnLnd', ({spawnLnd}, cbk) => {
      return generateInvoice({lnd: spawnLnd.lnd}, cbk);
    }],

    // Stop the dummy LND
    stopLnd: ['generatePaymentPreimage', 'spawnLnd', ({spawnLnd}, cbk) => {
      return spawnLnd.kill({}, cbk);
    }],

    // A bunch of blocks are made so Alice's rewards are mature
    generateToMaturity: [
      'mineToAddress',
      'spawnChainDaemon',
      ({mineToAddress}, cbk) =>
    {
      return generateChainBlocks({
        address: mineToAddress,
        count: chainConstants.maturity_block_count,
        delay: generateDelayMs,
        network: args.network,
      },
      cbk);
    }],

    // Get the state of the chain at maturity when Alice is ready to spend
    getMatureChainInfo: ['generateToMaturity', ({}, cbk) => {
      return getCurrentHeight({network: args.network}, cbk);
    }],

    // Determine the height at which a refund is possible
    swapRefundHeight: ['getMatureChainInfo', ({getMatureChainInfo}, cbk) => {
      return cbk(null, getMatureChainInfo.height + swapTimeoutBlocks);
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
          network: args.network,
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
        vout: chainConstants.coinbase_tx_index,
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
        destination: res.createChainSwapAddress[`${args.swap_type}_address`],
        network: args.network,
        private_key: res.generateAliceKeyPair.private_key,
        spend_transaction_id: res.aliceUtxo.transaction_id,
        spend_vout: res.aliceUtxo.vout,
        tokens: res.aliceUtxo.tokens,
      },
      cbk);
    }],

    // The swap funding transaction is mined
    mineFundingTx: [
      'fundSwapAddress',
      'mineToAddress',
      ({fundSwapAddress, mineToAddress}, cbk) =>
    {
      return mineTransaction({
        address: mineToAddress,
        network: args.network,
        transaction: fundSwapAddress.transaction,
      },
      cbk);
    }],

    // Alice checks the height after funding
    getHeightAfterFunding: ['mineFundingTx', ({}, cbk) => {
      return getCurrentHeight({network: args.network}, cbk);
    }],

    // Alice picks up her funding utxos
    fundingTransactionUtxos: [
      'createChainSwapAddress',
      'fundSwapAddress',
      ({createChainSwapAddress, fundSwapAddress}, cbk) =>
    {
      try {
        return cbk(null, swapScriptInTransaction({
          redeem_script: createChainSwapAddress.redeem_script,
          transaction: fundSwapAddress.transaction,
        }));
      } catch (e) {
        return cbk([0, e.message, e]);
      }
    }],

    // Alice makes a transaction to claim her refund too early
    tooEarlyRefundTx: [
      'fundingTransactionUtxos',
      'generateAliceKeyPair',
      'getHeightAfterFunding',
      (res, cbk) =>
    {
      try {
        return cbk(null, refundTransaction({
          destination: res.generateAliceKeyPair.p2pkh_address,
          fee_tokens_per_vbyte: staticFeePerVirtualByte,
          is_public_key_hash_refund: args.is_refund_to_public_key_hash,
          network: args.network,
          private_key: res.generateAliceKeyPair.private_key,
          timelock_block_height: res.getHeightAfterFunding.height,
          utxos: res.fundingTransactionUtxos.matching_outputs,
        }));
      } catch (err) {
        return cbk([0, 'ExpectedRefundTx', err]);
      }
    }],

    // Alice tries to claim her refund right away but hits `refund_too_early`
    broadcastEarlyRefundTx: ['tooEarlyRefundTx', (res, cbk) => {
      return broadcastTransaction({
        network: args.network,
        transaction: res.tooEarlyRefundTx.transaction,
      },
      err => {
        if (!Array.isArray(err)) {
          return cbk([0, 'ExpectedTxFailsCltvCheck']);
        }

        const [code, msg] = err;

        if (code !== 503) {
          return cbk([0, 'ExpectedRemoteErrorForBroadcastFailure']);
        }

        if (msg !== 'TransactionBroadcastFailed') {
          return cbk([0, 'ExpectedTransactionBroadcastFailure']);
        }

        return cbk();
      });
    }],

    // Bob never gets the preimage and claims his funds. Many blocks go by
    generateTimeoutBlocks: [
      'mineFundingTx',
      'mineToAddress',
      ({mineToAddress}, cbk) =>
    {
      return generateChainBlocks({
        address: mineToAddress,
        count: swapTimeoutBlocks,
        network: args.network,
      },
      cbk);
    }],

    // Grab the current height to use in the sweep tx
    getHeightForRefund: ['generateTimeoutBlocks', ({}, cbk) => {
      return getCurrentHeight({network: args.network}, cbk);
    }],

    // Alice will claim her refunded tokens after the timeout
    sweepTransaction: [
      'createChainSwapAddress',
      'fundSwapAddress',
      'fundingTransactionUtxos',
      'generateAliceKeyPair',
      'getHeightForRefund',
      'mineFundingTx',
      (res, cbk) =>
    {
      let refundPsbt;
      let signedRefund;

      try {
        refundPsbt = createRefundPsbt({
          fee_tokens_per_vbyte: staticFeePerVirtualByte,
          network: args.network,
          refund_address: res.generateAliceKeyPair.p2pkh_address,
          transactions: [res.fundSwapAddress.transaction],
          utxos: res.fundingTransactionUtxos.matching_outputs.map(utxo => {
            return {
              redeem: res.createChainSwapAddress.redeem_script,
              script: utxo.script,
              tokens: utxo.tokens,
              transaction_id: utxo.transaction_id,
              vout: utxo.vout,
            };
          }),
        });
      } catch (err) {
        return cbk([500, 'ExpectedRefundPsbt', err]);
      }

      try {
        signedRefund = signRefundPsbt({
          key: res.generateAliceKeyPair.private_key,
          network: args.network,
          psbt: refundPsbt.psbt,
        });
      } catch (err) {
        return cbk([500, 'ExpectedSignedRefundPsbt', err]);
      }

      return cbk(null, signedRefund);
    }],

    // Mine the sweep transaction into a block
    mineSweepTransaction: [
      'mineToAddress',
      'sweepTransaction',
      ({mineToAddress, sweepTransaction}, cbk) =>
    {
      return mineTransaction({
        address: mineToAddress,
        network: args.network,
        transaction: sweepTransaction.transaction,
      },
      cbk);
    }],

    // Shut down the chain daemon
    stopChainDaemon: ['mineSweepTransaction', ({}, cbk) => {
      return stopChainDaemon({network: args.network}, cbk);
    }],
  },
  (err, res) => {
    if (!!res && !!res.spawnChainDaemon) {
      res.spawnChainDaemon.daemon.kill();
    }

    if (!!err) {
      return cbk(err);
    }

    return clearCache({cache: 'memory'}, cbk);
  });
};

