const asyncAuto = require('async/auto');
const asyncMapSeries = require('async/mapSeries');
const {Transaction} = require('bitcoinjs-lib');

const getBlock = require('./get_block');
const getTransaction = require('./get_transaction');

const {returnResult} = require('./../async-util');

/** Get details for a block

  {
    block_hash: <Block Hash Hex String>
    network: <Network Name String>
  }

  @returns via cbk
  {
    transactions: [{
      id: <Transaction Id Hex String>
      outputs: [{
        tokens: <Tokens Send Number>
      }]
    }]
  }
*/
module.exports = (args, cbk) => {
  return asyncAuto({
    // Get the high level block details, with transaction ids
    getBlock: cbk => {
      return getBlock({
        block_hash: args.block_hash,
        network: args.network
      },
      cbk);
    },

    // Get the transactions out of the blocks
    getTransactions: ['getBlock', ({getBlock}, cbk) => {
      return asyncMapSeries(getBlock.transaction_ids, (txId, cbk) => {
        return getTransaction({
          network: args.network,
          transaction_id: txId,
        },
        cbk);
      },
      cbk);
    }],

    // Final set of transactions in the block
    transactions: ['getTransactions', ({getTransactions}, cbk) => {
      // Convert raw tx hexes into ids and output tokens
      const transactions = getTransactions
        .map(n => n.transaction)
        .map(txHex => Transaction.fromHex(txHex))
        .map(tx => ({id: tx.getId(), o: tx.outs}))
        .map(t => ({id: t.id, outputs: t.o.map(o => ({tokens: o.value}))}));

      return cbk(null, {transactions});
    }],
  },
  returnResult({of: 'transactions'}, cbk));
};

