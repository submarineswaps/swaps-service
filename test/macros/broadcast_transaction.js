const chainRpc = require('./chain_rpc');

const {sendRawTransaction} = require('./../conf/rpc_commands');

/** Broadcast a transaction

  {
    network: <Network Name String>
    transaction: <Transaction Hex String>
  }
*/
module.exports = ({network, transaction}, cbk) => {
  return chainRpc({
    network,
    cmd: sendRawTransaction,
    params: [transaction],
  },
  (err, transactionId) => {
    if (!!err) {
      return cbk(err);
    }

    if (!transactionId) {
      return cbk([503, 'Transaction failed to broadcast']);
    }

    return cbk(null, transactionId);
  });
};

