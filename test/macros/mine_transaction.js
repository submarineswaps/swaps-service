const asyncAuto = require('async/auto');

const broadcastTransaction = require('./broadcast_transaction');
const generateChainBlocks = require('./generate_chain_blocks');
const returnResult = require('./return_result');

/** Mine a transaction into a block

  {
    block_reward_public_key: <Public Key Hex String>
    transaction: <Transaction Hex String>
  }
*/
module.exports = (args, cbk) => {
  return asyncAuto({
    broadcastTransaction: cbk => {
      return broadcastTransaction({transaction: args.transaction}, cbk);
    },

    generateBlock: ['broadcastTransaction', (res, cbk) => {
      return generateChainBlocks({
        blocks_count: [args.transaction].length,
        reward_public_key: args.block_reward_public_key,
      },
      cbk);
    }],
  },
  returnResult({}, cbk));
};

