const asyncAuto = require('async/auto');
const asyncConstant = require('async/constant');
const {ints} = require('random-lib');

const {addDetectedSwap} = require('./../../pool');
const {broadcastTransaction} = require('./../../chain');
const {claimTransaction} = require('./../../swaps');
const {chainConstants} = require('./../../chain');
const {clearCache} = require('./../../cache');
const {ECPair} = require('./../../tokenslib');
const {generateChainBlocks} = require('./../../chain');
const generateInvoice = require('./generate_invoice');
const {generateKeyPair} = require('./../../chain');
const {getCurrentHeight} = require('./../../chain');
const {getDetectedSwaps} = require('./../../pool');
const mineTransaction = require('./mine_transaction');
const {networks} = require('./../../tokenslib');
const {refundTransaction} = require('./../../swaps');
const sendChainTokensTransaction = require('./send_chain_tokens_tx');
const serverSwapKeyPair= require('./../../service/server_swap_key_pair');
const spawnChainDaemon = require('./spawn_chain_daemon');
const {swapAddress} = require('./../../swaps');
const {swapScanner} = require('./../../scan');
const {stopChainDaemon} = require('./../../chain');
const {Transaction} = require('./../../tokenslib');
const {watchSwapOutput} = require('./../../scan');

const coinbaseIndex = chainConstants.coinbase_tx_index;
const {fromPublicKeyBuffer} = ECPair;
const maturityBlockCount = chainConstants.maturity_block_count;
const maxKeyIndex = 4e8;
const minKeyIndex = 0;
const relayFeeTokensPerVirtualByte = 1;
const swapTimeoutBlockCount = 2;

/** Test that the swap scanner sees swaps progress

  {
    cache: <Cache Type String>
    daemon: <Daemon Type String>
    network: <Network Name String>
    type: <Resolution Type String> 'claim|refund'
  }
*/
module.exports = ({cache, daemon, network, type}, cbk) => {
  let scanner;

  return asyncAuto({
    // The fee rate that is needed for a claim transaction
    feeRate: asyncConstant(relayFeeTokensPerVirtualByte),

    // Claim key index
    index: cbk => {
      return ints({max: maxKeyIndex, min: minKeyIndex}, (err, res) => {
        if (!!err || !Array.isArray(res)) {
          return cbk([0, 'FailedToGenerateRandomIndex', e]);
        }

        const [index] = res;

        if (index === undefined || index === null) {
          return cbk([0, 'UnexpectedRandomIntResult']);
        }

        return cbk(null, index);
      });
    },

    // Generate a key pair to use for mining and a swap invoice
    generateKeyPair: ['index', ({index}, cbk) => {
      try {
        return cbk(null, serverSwapKeyPair({index, network}));
      } catch (e) {
        return cbk([0, 'ExpectedGeneratedKeyPair', e]);
      }
    }],

    // Generate a swap invoice
    generateSwapInvoice: ['generateKeyPair', ({generateKeyPair}, cbk) => {
      return generateInvoice({
        network,
        private_key: generateKeyPair.private_key,
      },
      cbk);
    }],

    // Determine mine-to-address
    mineToAddress: ['generateKeyPair', ({generateKeyPair}, cbk) => {
      switch (daemon) {
      case 'bcash':
      case 'bcoin':
      case "bitcoind":
        const key = Buffer.from(generateKeyPair.public_key, 'hex');
        const net = networks[network];

        return cbk(null, fromPublicKeyBuffer(key, net).getAddress());
      case 'btcd':
      case 'ltcd':
        return cbk();

      default:
        return cbk([400, 'UnexpectedDaemonForGeneration', daemon]);
      }
    }],

    // Spin up a chain daemon to generate blocks
    spawnChainDaemon: ['generateKeyPair', ({generateKeyPair}, cbk) => {
      return spawnChainDaemon({
        daemon,
        network,
        mining_public_key: generateKeyPair.public_key,
      },
      cbk);
    }],

    // Bring up the scanner
    initializeScanner: ['spawnChainDaemon', ({}, cbk) => {
      try {
        scanner = swapScanner({cache, network});

        scanner.on('error', () => {});

        return cbk(null, scanner);
      } catch (e) {
        return cbk([0, 'FailedToInitScanner', e]);
      }
    }],

    // The chain needs to progress to maturity for spending purposes
    generateToMaturity: [
      'initializeScanner',
      'mineToAddress',
      'spawnChainDaemon',
      ({mineToAddress}, cbk) =>
    {
      return generateChainBlocks({
        network,
        address: mineToAddress,
        count: maturityBlockCount,
      },
      cbk);
    }],

    // Create a chain swap address
    createSwapAddress: [
      'generateKeyPair',
      'generateSwapInvoice',
      ({generateKeyPair, generateSwapInvoice}, cbk) =>
    {
      try {
        return cbk(null, swapAddress({
          network,
          destination_public_key: generateKeyPair.public_key,
          payment_hash: generateSwapInvoice.payment_hash,
          refund_public_key_hash: generateKeyPair.pk_hash,
          timeout_block_height: maturityBlockCount + swapTimeoutBlockCount,
        }));
      } catch (e) {
        return cbk([0, 'ChainSwapAddrCreationFail', e]);
      }
    }],

    // Get a UTXO that can be spent to the swap
    utxo: ['generateToMaturity', ({generateToMaturity}, cbk) => {
      const [firstRewardBlock] = generateToMaturity.blocks;

      const [coinbaseTransaction] = firstRewardBlock.transactions;

      const [firstCoinbaseOutput] = coinbaseTransaction.outputs;

      return cbk(null, {
        tokens: firstCoinbaseOutput.tokens,
        transaction_id: coinbaseTransaction.id,
        vout: coinbaseIndex,
      });
    }],

    // Add the swap address to the scanner watch list
    watchSwap: [
      'createSwapAddress',
      'generateSwapInvoice',
      'index',
      'utxo',
      ({createSwapAddress, generateSwapInvoice, index, utxo}, cbk) =>
    {
      return watchSwapOutput({
        cache,
        index,
        network,
        invoice: generateSwapInvoice.invoice,
        script: createSwapAddress.redeem_script,
        tokens: utxo.tokens,
      },
      cbk);
    }],

    // Make a send transaction to fund the swap
    fundingTransaction: [
      'createSwapAddress',
      'generateKeyPair',
      'utxo',
      'watchSwap',
      ({createSwapAddress, generateKeyPair, utxo}, cbk) =>
    {
      return sendChainTokensTransaction({
        network,
        destination: createSwapAddress.p2sh_p2wsh_address,
        private_key: generateKeyPair.private_key,
        spend_transaction_id: utxo.transaction_id,
        spend_vout: utxo.vout,
        tokens: utxo.tokens,
      },
      cbk);
    }],

    // Make sure there is a mempool swap announcement
    waitForMempoolSwap: [
      'createSwapAddress',
      'fundingTransaction',
      'generateSwapInvoice',
      ({fundingTransaction, generateSwapInvoice}, cbk) =>
    {
      const {transaction} = fundingTransaction;

      return scanner.once('funding', swap => {
        try {
          const fundTxId = Transaction.fromHex(transaction).getId();

          if (fundTxId !== swap.id) {
            throw new Error('ExpectedFundingTransaction');
          }
        } catch (e) {
          return cbk([0, 'MempoolTxAnnounceFailure', e]);
        }

        if (swap.invoice !== generateSwapInvoice.invoice) {
          return cbk([0, 'ExpectedSwapInvoice']);
        }

        return cbk(null, swap);
      });
    }],

    // Notify the swap elements pool there was a funding tx detected
    addFundingToPool: [
      'generateSwapInvoice',
      'waitForMempoolSwap',
      ({generateSwapInvoice, waitForMempoolSwap}, cbk) =>
    {
      return addDetectedSwap({
        cache,
        funding: {
          network,
          id: waitForMempoolSwap.id,
          index: waitForMempoolSwap.index,
          invoice: waitForMempoolSwap.invoice,
          output: waitForMempoolSwap.output,
          script: waitForMempoolSwap.script,
          tokens: waitForMempoolSwap.tokens,
          type: waitForMempoolSwap.type,
          vout: waitForMempoolSwap.vout,
        },
        id: generateSwapInvoice.payment_hash,
      },
      cbk);
    }],

    // Push the funding transaction into the mempool
    broadcastFunding: ['fundingTransaction', 'generateToMaturity', ({fundingTransaction}, cbk) => {
      return broadcastTransaction({
        network,
        transaction: fundingTransaction.transaction,
      },
      cbk);
    }],

    // Mine funding transaction into a block
    confirmFunding: [
      'broadcastFunding',
      'fundingTransaction',
      'mineToAddress',
      'waitForMempoolSwap',
      ({fundingTransaction, mineToAddress}, cbk) =>
    {
      const address = mineToAddress;
      const {transaction} = fundingTransaction;

      return mineTransaction({address, network, transaction}, cbk);
    }],

    // Make sure there are block swap announcements
    swapFunded: [
      'generateSwapInvoice',
      'initializeScanner',
      ({generateSwapInvoice}, cbk) =>
    {
      return scanner.once('funding', swap => {
        if (swap.invoice !== generateSwapInvoice.invoice) {
          return cbk([0, 'ExpectedSwapInvoice']);
        }

        return cbk(null, {swap});
      });
    }],

    // Get the current blockchain height for the claim transaction
    getCurrentHeight: ['confirmFunding', ({}, cbk) => {
      return getCurrentHeight({network}, cbk);
    }],

    /**
                    Ready for a resolution!
    */

    // Find current chain details for the claim transaction
    resolutionChainDetails: [
      'feeRate',
      'generateKeyPair',
      'getCurrentHeight',
      ({feeRate, generateKeyPair, getCurrentHeight}, cbk) =>
    {
      return cbk(null, {
        current_block_height: getCurrentHeight.height,
        destination: generateKeyPair.p2wpkh_address,
        fee_tokens_per_vbyte: feeRate,
      });
    }],

    // Find the details about the funded swap
    swapDetails: [
      'generateSwapInvoice',
      'swapFunded',
      ({generateSwapInvoice, swapFunded}, cbk) =>
    {
      return cbk(null, {
        preimage: generateSwapInvoice.payment_preimage,
        utxo_output_script: swapFunded.swap.output,
        utxo_redeem_script: swapFunded.swap.script,
        utxo_tokens: swapFunded.swap.tokens,
        utxo_transaction_id: swapFunded.swap.id,
        utxo_vout: swapFunded.swap.vout,
      });
    }],

    // Claim transaction to claim funding transaction
    claimTransaction: [
      'generateKeyPair',
      'resolutionChainDetails',
      'swapDetails',
      ({generateKeyPair, resolutionChainDetails, swapDetails}, cbk) =>
    {
      try {
        return cbk(null, claimTransaction({
          network,
          current_block_height: resolutionChainDetails.current_block_height,
          destination: resolutionChainDetails.destination,
          fee_tokens_per_vbyte: resolutionChainDetails.fee_tokens_per_vbyte,
          preimage: swapDetails.preimage,
          private_key: generateKeyPair.private_key,
          utxos: [{
            redeem: swapDetails.utxo_redeem_script,
            script: swapDetails.utxo_output_script,
            tokens: swapDetails.utxo_tokens,
            transaction_id: swapDetails.utxo_transaction_id,
            vout: swapDetails.utxo_vout,
          }],
        }));
      } catch (e) {
        return cbk([0, 'FailedToCreateClaimTransaction', e]);
      }
    }],

    // Refund transaction to refund money without the preimage
    refundTransaction: [
      'generateKeyPair',
      'resolutionChainDetails',
      'swapDetails',
      ({generateKeyPair, resolutionChainDetails, swapDetails}, cbk) =>
    {
      try {
        return cbk(null, refundTransaction({
          network,
          destination: resolutionChainDetails.destination,
          fee_tokens_per_vbyte: resolutionChainDetails.fee_tokens_per_vbyte,
          is_public_key_hash_refund: true,
          private_key: generateKeyPair.private_key,
          timelock_block_height: maturityBlockCount + swapTimeoutBlockCount,
          utxos: [{
            redeem: swapDetails.utxo_redeem_script,
            script: swapDetails.utxo_output_script,
            tokens: swapDetails.utxo_tokens,
            transaction_id: swapDetails.utxo_transaction_id,
            vout: swapDetails.utxo_vout,
          }],
        }));
      } catch (e) {
        return cbk([0, 'FailedToCreateRefundTransaction', e]);
      }
    }],

    // Transaction to use as a resolution transaction
    resolutionTx: [
      'claimTransaction',
      'refundTransaction',
      ({claimTransaction, refundTransaction}, cbk) =>
    {
      const isClaim = type === 'claim';

      const {transaction} = (isClaim ? claimTransaction : refundTransaction);

      return cbk(null, transaction);
    }],

    // Broadcast the claim or refund transaction
    broadcastResolution: ['resolutionTx', ({resolutionTx}, cbk) => {
      return setTimeout(() => {
        const transaction = resolutionTx;

        return broadcastTransaction({network, transaction}, cbk);
      },
      500);
    }],

    // Wait for the resolution transaction to enter the mempool
    resolutionInMempool: [
      'initializeScanner',
      'resolutionTx',
      ({resolutionTx}, cbk) =>
    {
      const expectedId = Transaction.fromHex(resolutionTx).getId();

      return scanner.once(type, swap => {
        try {
          if (swap.id !== expectedId) {
            throw new Error('ExpectedResolutionTransaction');
          }
        } catch (e) {
          return cbk([0, 'MempoolClaimAnnounceFailure', e]);
        }

        return cbk(null, swap);
      });
    }],

    // Add the found resolution to the pool
    addResolutionToPool: [
      'generateSwapInvoice',
      'resolutionInMempool',
      ({generateSwapInvoice, resolutionInMempool}, cbk) =>
    {
      const {id} = resolutionInMempool;
      const {invoice} = resolutionInMempool;
      const {network} = resolutionInMempool;
      const {outpoint} = resolutionInMempool;
      const {preimage} = resolutionInMempool;
      const {script} = resolutionInMempool;

      switch (type) {
      case 'claim':
        return addDetectedSwap({
          cache,
          claim: {id, invoice, network, outpoint, preimage, script, type},
          id: generateSwapInvoice.payment_hash,
        },
        cbk);

      case 'refund':
        return addDetectedSwap({
          cache,
          refund: {id, invoice, network, outpoint, script, type},
          id: generateSwapInvoice.payment_hash,
        },
        cbk);

      default:
        return cbk([0, 'UnexpectedSwapTypeToAdd', type]);
      }
    }],

    // Make sure the resolution confirmation is announced
    resolutionConfirmed: [ 'broadcastResolution', ({}, cbk) => {
      return scanner.once(type, swap => cbk(null, {swap}));
    }],

    // Mine resolution transaction into a block
    confirmResolution: [
      'mineToAddress',
      'resolutionInMempool',
      ({mineToAddress, resolutionTx}, cbk) =>
    {
      const address = mineToAddress;
      const transaction = resolutionTx;

      return mineTransaction({address, network, transaction}, cbk);
    }],

    // Get the detected swap elements from the pool
    getDetectedSwaps: [
      'addFundingToPool',
      'addResolutionToPool',
      'confirmResolution',
      'generateSwapInvoice',
      ({generateSwapInvoice}, cbk) =>
    {
      return getDetectedSwaps({
        cache,
        id: generateSwapInvoice.payment_hash,
      },
      cbk);
    }],

    // Check that the detected swap elements in the pool are correct
    checkDetectedSwaps: ['getDetectedSwaps', ({getDetectedSwaps}, cbk) => {
      const {claim} = getDetectedSwaps;
      const {funding} = getDetectedSwaps;
      const {refund} = getDetectedSwaps;

      if (funding.length !== 1) {
        return cbk([0, 'ExpectedFundingTransactionDetected']);
      }

      switch (type) {
      case 'claim':
        if (claim.length !== 1) {
          return cbk([0, 'ExpectedClaimTransactionDetected']);
        }

        if (!!refund.length) {
          return cbk([0, 'ExpectedRefundNotPresent']);
        }

        break;

      case 'refund':
        if (refund.length !== 1) {
          return cbk([0, 'ExpectedRefundTransactionDetected']);
        }

        if (!!claim.length) {
          return cbk([0, 'ExpectedClaimNotPresent']);
        }

        break;

      default:
        return cbk([0, 'UnexpectedSwapResolutionType']);
      }

      return cbk();
    }],
  },
  (err, res) => {
    if (!!res.spawnChainDaemon && !!res.spawnChainDaemon.is_ready) {
      return stopChainDaemon({network}, stopErr => {
        return cbk(stopErr || err);
      });
    }

    if (!!err) {
      return cbk(err);
    }

    return clearCache({cache: 'memory'}, cbk);
  });
};

