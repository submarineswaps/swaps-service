const asyncAuto = require('async/auto');
const asyncMapSeries = require('async/mapSeries');
const asyncTimesSeries = require('async/timesSeries');

const chainRpc = require('./chain_rpc');
const getBlockDetails = require('./get_block_details');
const returnResult = require('./return_result');

const {generate} = require('./../conf/rpc_commands');

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
      return asyncTimesSeries(args.blocks_count, (_, cbk) => {
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
    getBlockDetails: ['generateBlocks', (res, cbk) => {
      return asyncMapSeries(res.generateBlocks, (blockHash, cbk) => {
        return getBlockDetails({
          block_hash: blockHash,
          network: args.network,
        },
        cbk);
      },
      cbk);
    }],

    // Wrap blocks in object
    blocks: ['getBlockDetails', (res, cbk) => {
      return cbk(null, {blocks: res.getBlockDetails});
    }],
  },
  returnResult({of: 'blocks'}, cbk));
};

