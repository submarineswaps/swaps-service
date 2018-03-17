const asyncAuto = require('async/auto');
const asyncDetectLimit = require('async/detectLimit');

const {getMempool} = require('./../chain');
const {returnResult} = require('./../async-util');
const transactionHasScriptPub = require('./transaction_has_scriptpub');

const checkFanOutLimit = 10;

/** Scan the mempool to find a transaction that matches script-pubs

  {
    network: <Network Name String>
    output_scripts: [<Output Script Hex String>]
  }

  @returns via cbk
  {
    [transaction_id]: <Transaction Id Hex String>
  }
*/
module.exports = (args, cbk) => {
  return asyncAuto({
    // Pull all the transaction ids from the mempool
    getMempool: cbk => getMempool({network: args.network}, cbk),

    // Run through transaction ids and see if they have a matching output
    findTransaction: ['getMempool', ({getMempool}, cbk) => {
      return asyncDetectLimit(
        getMempool.transaction_ids,
        checkFanOutLimit,
        (id, cbk) => transactionHasScriptPub({
          network: args.network,
          output_scripts: args.output_scripts,
          transaction_id: id,
        },
        cbk),
        cbk
      );
    }],

    // The result of the search
    found: ['findTransaction', ({findTransaction}, cbk) => {
      return cbk(null, {transaction_id: findTransaction});
    }],
  },
  returnResult({of: 'found'}, cbk));
};

