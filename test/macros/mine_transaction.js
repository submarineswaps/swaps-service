const asyncAuto = require('async/auto');
const {returnResult} = require('asyncjs-util');

const {broadcastTransaction} = require('./../../chain');
const generateChainBlocks = require('./generate_chain_blocks');
const {getTransaction} = require('./../../chain');
const {Transaction} = require('./../../tokenslib');

const txConfirmationCount = 6;

/** Mine a transaction into a block

  {
    [address]: <Address to Mine To String>
    network: <Network Name String>
    transaction: <Transaction Hex String>
  }
*/
module.exports = ({address, network, transaction}, cbk) => {
  return asyncAuto({
    // Transaction id
    id: cbk => {
      try {
        return cbk(null, Transaction.fromHex(transaction).getId());
      } catch (e) {
        return cbk([400, 'ExpectedValidTransactionToMine']);
      }
    },

    // Check if the transaction is already broadcast
    getTransaction: ['id', ({id}, cbk) => getTransaction({id, network}, cbk)],

    // Broadcast the transaction into the mempool
    broadcastTransaction: ['getTransaction', ({getTransaction}, cbk) => {
      // Exit early when the transaction has already been broadcast
      if (!!getTransaction.transaction) {
        return cbk();
      }

      return broadcastTransaction({network, transaction}, cbk);
    }],

    // Generate blocks to confirm the transaction into a block
    generateBlock: ['broadcastTransaction', ({}, cbk) => {
      return generateChainBlocks({
        address,
        network,
        count: txConfirmationCount,
      },
      cbk);
    }],
  },
  returnResult({}, cbk));
};

