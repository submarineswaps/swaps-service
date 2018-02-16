const asyncAuto = require('async/auto');
const asyncMapSeries = require('async/mapSeries');
const {Transaction} = require('bitcoinjs-lib');

const chainRpc = require('./chain_rpc');
const returnResult = require('./return_result');

const {getBlock, getRawTransaction} = require('./../conf/rpc_commands');

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
    getBlock: cbk => {
      return chainRpc({
        cmd: getBlock,
        network: args.network,
        params: [args.block_hash, true],
      },
      cbk);
    },

    getTransactions: ['getBlock', (res, cbk) => {
      return asyncMapSeries(res.getBlock.tx, (txId, cbk) => {
        return chainRpc({
          cmd: getRawTransaction,
          network: args.network,
          params: [txId],
        },
        cbk);
      },
      (err, rawTxs) => {
        if (!!err) {
          return cbk(err);
        }

        const transactions = rawTxs
        .map(txHex => Transaction.fromHex(txHex))
        .map(tx => ({id: tx.getId(), o: tx.outs}))
        .map(tx => ({id: tx.id, outputs: tx.o.map(o => ({tokens: o.value}))}));

        return cbk(null, {transactions});
      });
    }],
  },
  returnResult({of: 'getTransactions'}, cbk));
};

