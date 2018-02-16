const chainRpc = require('./chain_rpc');

const {sendRawTransaction} = require('./../conf/rpc_commands');
const {serviceUnavailable} = require('./../conf/error_codes');

const cmd = sendRawTransaction;

/** Broadcast a transaction

  {
    network: <Network Name String>
    transaction: <Transaction Hex String>
  }
*/
module.exports = ({network, transaction}, cbk) => {
  const params = [transaction];

  return chainRpc({cmd, network, params}, (err, transactionId) => {
    if (!!err) {
      return cbk(err);
    }

    if (!transactionId) {
      return cbk([serviceUnavailable, 'Transaction failed to broadcast']);
    }

    return cbk(null, transactionId);
  });
};

