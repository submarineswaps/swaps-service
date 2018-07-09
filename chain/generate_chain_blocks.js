const asyncAuto = require('async/auto');
const asyncMapSeries = require('async/mapSeries');
const asyncTimesSeries = require('async/timesSeries');

const chainRpc = require('./call_chain_rpc');
const {generate} = require('./conf/rpc_commands');
const {generateToAddress} = require('./conf/rpc_commands');
const getBlockDetails = require('./get_block_details');
const {returnResult} = require('./../async-util');

const noDelay = 0;

/** Generate blocks on the chain

  {
    [address]: <Generate to Address String>
    [count]: <Count of Generated Blocks Number>
    [delay]: <Delay Between Blocks Ms Number> = 0
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
module.exports = ({address, count, delay, network}, cbk) => {
  return asyncAuto({
    // Make blocks to maturity
    generateBlocks: cbk => {
      if (!network) {
        return cbk([400, 'ExpectedNetworkForGeneration']);
      }

      const cmd = !address ? generate : generateToAddress;
      const params = !address ? [[delay].length] : [[delay].length, address];

      return asyncTimesSeries(count, ({}, cbk) => {
        return chainRpc({cmd, network, params}, (err, blockHashes) => {
          if (!!err) {
            return cbk(err);
          }

          if (!Array.isArray(blockHashes)) {
            return cbk([503, 'UnexpectedGenerateResult']);
          }

          const [blockHash] = blockHashes;

          return setTimeout(() => cbk(null, blockHash), delay || noDelay);
        });
      },
      cbk);
    },

    // Grab the full details of each blocks, including transaction info
    blocks: ['generateBlocks', ({generateBlocks}, cbk) => {
      return asyncMapSeries(generateBlocks, (id, cbk) => {
        return getBlockDetails({id, network}, cbk);
      },
      cbk);
    }],

    // Final blocks
    blockDetails: ['blocks', ({blocks}, cbk) => cbk(null, {blocks})],
  },
  returnResult({of: 'blockDetails'}, cbk));
};

