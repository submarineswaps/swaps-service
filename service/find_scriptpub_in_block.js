const asyncAuto = require('async/auto');
const asyncDetectLimit = require('async/detectLimit');

const {getBlock} = require('./../chain');
const {returnResult} = require('./../async-util');
const transactionHasScriptPub = require('./transaction_has_scriptpub');

const checkFanOutLimit = 2;

/** Scan a block to find a transaction that matches script-pubs

  {
    block_hash: <Block Hash Hex String>
    network: <Network Name String>
    output_scripts: [<Output Script Hex String>]
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
        return cbk([500, 'ExpectedBlockHash']);
      }

      if (!args.network) {
        return cbk([500, 'ExpectedNetwork']);
      }

      if (!Array.isArray(args.output_scripts) || !args.output_scripts.length) {
        return cbk([500, 'ExpectedOutputScripts']);
      }

      return cbk();
    },

    // Get the transaction ids in the referenced block hash
    getBlock: cbk => {
      return getBlock({
        block_hash: args.block_hash,
        network: args.network,
      },
      cbk);
    },

    // Find transaction in block
    findTransaction: ['getBlock', ({getBlock}, cbk) => {
      return asyncDetectLimit(
        getBlock.transaction_ids,
        checkFanOutLimit,
        (id, cbk) => {
          return transactionHasScriptPub({
            network: args.network,
            output_scripts: args.output_scripts,
            transaction_id: id,
          },
          cbk);
        },
        cbk
      );
    }],

    found: ['findTransaction', 'getBlock', (res, cbk) => {
      return cbk(null, {
        previous_block_hash: res.getBlock.previous_block_hash,
        transaction_id: res.findTransaction,
      });
    }],
  },
  returnResult({of: 'found'}, cbk));
};

