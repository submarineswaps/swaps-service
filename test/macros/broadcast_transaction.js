const chainRpc = require('./chain_rpc');

const errCode = require('./../conf/error_codes');
const {sendRawTransaction} = require('./../conf/rpc_commands');

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
      return cbk([errCode.service_unavailable, 'Transaction broadcast fail']);
    }

    return cbk(null, transactionId);
  });
};

