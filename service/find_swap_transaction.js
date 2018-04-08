const asyncAuto = require('async/auto');
const asyncConstant = require('async/constant');
const asyncUntil = require('async/until');

const findScriptPubInBlock = require('./find_scriptpub_in_block');
const findScriptPubInMempool = require('./find_scriptpub_in_mempool');
const {getBlockchainInfo} = require('./../chain');
const {getTransaction} = require('./../chain');
const {returnResult} = require('./../async-util');
const {swapAddress} = require('./../swaps');

const blockSearchRateLimit = 300;

/** Find the swap funding transaction that matches a swap key

  {
    block_search_depth: <Block Search Depth Number>
    destination_public_key: <Destination Public Key Serialized String>
    network: <Network Name String>
    payment_hash: <Payment Hash String>
    [refund_public_key]: <Refund Public Key Hex String>
    [refund_public_key_hash]: <Refund Public Key Hash Hex String>
    timeout_block_height: <Swap Expiration Date Number>
  }

  @returns via cbk
  {
    [confirmation_count]: <Confirmation Count>
    [transaction]: <Transaction Hex String>
    [transaction_id]: <Transaction Id Hex String>
  }
*/
module.exports = (args, cbk) => {
  return asyncAuto({
    // Get the current block tip hash
    getChainInfo: cbk => getBlockchainInfo({network: args.network}, cbk),

    // Check the arguments
    validate: cbk => {
      if (!args.block_search_depth) {
        return cbk([500, 'ExpectedBlockSearchDepth']);
      }

      if (!args.destination_public_key) {
        return cbk([500, 'ExpectedDestinationPublicKey']);
      }

      if (!args.payment_hash) {
        return cbk([500, 'ExpectedPaymentHash']);
      }

      if (!args.refund_public_key && !args.refund_public_key_hash) {
        return cbk([500, 'ExpectedRefundKeyOrKeyHash']);
      }

      if (!args.timeout_block_height) {
        return cbk([500, 'ExpectedTimeoutBlockHeight']);
      }

      return cbk();
    },

    swap: ['validate', (_, cbk) => {
      return cbk(null, swapAddress({
        destination_public_key: args.destination_public_key,
        payment_hash: args.payment_hash,
        refund_public_key: args.refund_public_key,
        refund_public_key_hash: args.refund_public_key_hash,
        timeout_block_height: args.timeout_block_height,
      }));
    }],

    // Output scripts
    outputScripts: ['swap', ({swap}, cbk) => {
      return cbk(null, [
        swap.p2sh_output_script,
        swap.p2sh_p2wsh_output_script,
        swap.witness_output_script,
      ]);
    }],

    // Look in the mempool for the transaction
    findTransactionInMempool: ['outputScripts', ({outputScripts}, cbk) => {
      return findScriptPubInMempool({
        network: args.network,
        output_scripts: outputScripts,
      },
      cbk);
    }],

    // Scan blocks for the transaction
    scanBlocks: [
      'findTransactionInMempool',
      'getChainInfo',
      'outputScripts',
      ({findTransactionInMempool, getChainInfo, outputScripts}, cbk) =>
    {
      let count = 0;
      let cursor = getChainInfo.current_hash;
      let txId = findTransactionInMempool.transaction_id || null;

      return asyncUntil(
        () => !!txId || !cursor || count === args.block_search_depth,
        cbk => {
          return findScriptPubInBlock({
            block_hash: cursor,
            network: args.network,
            output_scripts: outputScripts,
          },
          (err, res) => {
            if (!!err) {
              return cbk(err);
            }

            count++;
            cursor = res.previous_block_hash;
            txId = res.transaction_id;

            return setTimeout(cbk, blockSearchRateLimit);
          });
        },
        err => {
          if (!!err) {
            return cbk(err);
          }

          return cbk(null, {confirmation_count: count, transaction_id: txId});
        }
      );
    }],

    // Get the raw transaction
    getTransaction: ['scanBlocks', ({scanBlocks}, cbk) => {
      if (!scanBlocks.transaction_id) {
        return cbk(null, {transaction: null});
      }

      return getTransaction({
        network: args.network,
        transaction_id: scanBlocks.transaction_id,
      },
      cbk);
    }],

    // Final transaction details
    transaction: ['getTransaction', ({getTransaction, scanBlocks}, cbk) => {
      return cbk(null, {
        confirmation_count: scanBlocks.confirmation_count,
        transaction: getTransaction.transaction,
        transaction_id: scanBlocks.transaction_id,
      });
    }],
  },
  returnResult({of: 'transaction'}, cbk));
};

