const asyncAuto = require('async/auto');
const asyncMapSeries = require('async/mapSeries');
const asyncTimesSeries = require('async/timesSeries');

const chainRpc = require('./call_chain_rpc');
const {generate} = require('./conf/rpc_commands');
const getBlockDetails = require('./get_block_details');
const {returnResult} = require('./../async-util');

const noDelay = 0;

/** Generate blocks on the chain

  {
    [blocks_count]: <Number of Blocks to Generate Number>
    [delay]: <Delay Between Blocks Ms> = 0
    network: <Network Name String>
  }

  @returns via cbk
  {
    blocks: [{
      transactions: [{
        id: <Transaction Id Hex String>
        outputs: [{
          tokens: <Tokens Send Number>
        }]
      }]
    }]
  }
*/
module.exports = (args, cbk) => {
  return asyncAuto({
    // Make blocks to maturity
    generateBlocks: cbk => {
      return asyncTimesSeries(args.blocks_count, ({}, cbk) => {
        return chainRpc({
          cmd: generate,
          network: args.network,
          params: [[args.delay].length],
        },
        (err, blockHashes) => {
          if (!!err) {
            return cbk(err);
          }

          const [blockHash] = blockHashes;

          return setTimeout(() => cbk(null, blockHash), args.delay || noDelay);
        });
      },
      cbk);
    },

    // Grab the full details of each blocks, including transaction info
    blocks: ['generateBlocks', ({generateBlocks}, cbk) => {
      return asyncMapSeries(generateBlocks, (blockHash, cbk) => {
        return getBlockDetails({id: blockHash, network: args.network}, cbk);
      },
      cbk);
    }],

    // Final blocks
    blockDetails: ['blocks', ({blocks}, cbk) => cbk(null, {blocks})],
  },
  returnResult({of: 'blockDetails'}, cbk));
};

