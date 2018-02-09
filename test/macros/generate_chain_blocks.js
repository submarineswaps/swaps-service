const asyncAuto = require('async/auto');
const asyncMapSeries = require('async/mapSeries');

const chainRpc = require('./chain_rpc');
const getBlockDetails = require('./get_block_details');
const returnResult = require('./return_result');

const {generate} = require('./../conf/rpc_commands');

const maturityBlockCount = 100;

/** Generate blocks on the chain

  {
    blocks_count: <Number of Blocks to Generate Number>
    reward_public_key: <Assign Coinbase Award to Serialized Public Key String>
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
      return chainRpc({cmd: generate, params: [maturityBlockCount]}, cbk);
    },

    // Grab the full details of each blocks, including transaction info
    getBlockDetails: ['generateBlocks', (res, cbk) => {
      return asyncMapSeries(res.generateBlocks, (blockHash, cbk) => {
        return getBlockDetails({block_hash: blockHash}, cbk);
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

