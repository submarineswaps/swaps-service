const asyncAuto = require('async/auto');
const asyncWhilst = require('async/whilst');
const {returnResult} = require('asyncjs-util');

const {getBlockMetadata} = require('./../blocks');
const {networks} = require('./../tokenslib');
const {swapParameters} = require('./../service');

const bufferTimeMs = 1000 * 60 * 30;
const {ceil} = Math;

/** Get past blocks

  {
    current: <Current Block Hash Hex String>
    network: <Network Name String>
  }

  @returns via cbk
  {
    blocks: [{
      id: <Block Id String>
      [previous_block_hash]: <Block Hash Hex String>
      transaction_ids: [<Transaction Id Hex String>]
    }]
  }
*/
module.exports = ({current, network}, cbk) => {
  if (!current) {
    return cbk([400, 'ExpectedCurrentBlockHash']);
  }

  if (!network) {
    return cbk([400, 'ExpectedNetworkName']);
  }

  const blocks = [];
  const buffer = ceil(bufferTimeMs / networks[network].ms_per_block);
  let cursor = current;
  let fetchBlocksCount;

  try {
    fetchBlocksCount = swapParameters({network}).funding_confs + buffer;
  } catch (err) {
    return cbk([400, 'FailedToDetermineSwapFundingConfsCount', err]);
  }

  return asyncWhilst(
    cbk => cbk(null, (blocks.length < fetchBlocksCount) && cursor),
    cbk => {
      return asyncAuto({
        // Get block metadata
        getBlock: cbk => getBlockMetadata({network, id: cursor}, cbk),

        // Final blocks result
        blocks: ['getBlock', ({getBlock}, cbk) => {
          getBlock.id = cursor;

          blocks.push(getBlock);
          cursor = getBlock.previous_block_hash;

          return cbk(null, {blocks});
        }],
      },
      returnResult({of: 'blocks'}, cbk));
    },
    cbk
  );
};

