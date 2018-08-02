const asyncAuto = require('async/auto');
const asyncWhilst = require('async/whilst');

const {getBlockMetadata} = require('./../blocks');
const {returnResult} = require('./../async-util');

const fetchBlocksCount = 3;

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
  let cursor = current;

  return asyncWhilst(
    () => blocks.length < fetchBlocksCount && cursor,
    cbk => {
      return asyncAuto({
        // Get block metadata
        getBlock: cbk => getBlockMetadata({network, id: cursor}, cbk),

        // Final blocks result
        blocks: ['getBlock', ({getBlock}, cbk) => {
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

