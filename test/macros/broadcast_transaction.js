const chainRpc = require('./chain_rpc');

const {sendRawTransaction} = require('./../conf/rpc_commands');

/** Broadcast a transaction

  {
    transaction: <Transaction Hex String>
  }
*/
module.exports = (args, cbk) => {
  return chainRpc({cmd: sendRawTransaction, params: [args.transaction]}, cbk);
};

