const asyncAuto = require('async/auto');
const asyncDetectLimit = require('async/detectLimit');

const {getBlockMetadata} = require('./../blocks');
const {returnResult} = require('./../async-util');
const transactionHasScriptPub = require('./transaction_has_scriptpub');

const checkFanOutLimit = 2;

/** Scan a block to find a transaction that matches script-pubs

  {
    cache: <Cache Type String>
    block_hash: <Block Hash Hex String>
    [is_ignoring_tokens]: <Is Ignoring Tokens Value Bool>
    network: <Network Name String>
    output_scripts: [<Output Script Hex String>]
    [tokens]: <Find Output with Tokens Number>
  }

  @returns via cbk
  {
    [previous_block_hash]: <Previous Block Hash Hex String>
    [transaction_id]: <Transaction Id Hex String>
  }
*/
module.exports = (args, cbk) => {
  return asyncAuto({
    // Check the arguments
    validate: cbk => {
      if (!args.block_hash) {
        return cbk([400, 'ExpectedBlockHash']);
      }

      if (!args.cache) {
        return cbk([400, 'ExpectedCacheTypeForResultCaching']);
      }

      if (!args.network) {
        return cbk([400, 'ExpectedNetwork']);
      }

      if (!Array.isArray(args.output_scripts) || !args.output_scripts.length) {
        return cbk([400, 'ExpectedOutputScripts']);
      }

      if (!args.tokens && !args.is_ignoring_tokens) {
        return cbk([400, 'ExpectedTokens']);
      }

      return cbk();
    },

    // Get the transaction ids in the referenced block hash
    getBlock: ['validate', ({}, cbk) => {
      return getBlockMetadata({
        id: args.block_hash,
        network: args.network,
      },
      cbk);
    }],

    // Find transaction in block
    findTransaction: ['getBlock', ({getBlock}, cbk) => {
      return asyncDetectLimit(
        getBlock.transaction_ids,
        checkFanOutLimit,
        (id, cbk) => {
          return transactionHasScriptPub({
            block: args.block_hash,
            cache: args.cache,
            is_ignoring_tokens: args.is_ignoring_tokens,
            network: args.network,
            output_scripts: args.output_scripts,
            tokens: args.tokens,
            transaction_id: id,
          },
          cbk);
        },
        cbk
      );
    }],

    // Final found result
    found: ['findTransaction', 'getBlock', (res, cbk) => {
      return cbk(null, {
        previous_block_hash: res.getBlock.previous_block_hash,
        transaction_id: res.findTransaction,
      });
    }],
  },
  returnResult({of: 'found'}, cbk));
};

