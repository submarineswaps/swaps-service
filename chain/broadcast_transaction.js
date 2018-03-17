const chainRpc = require('./chain_rpc');

const cmd = require('./conf/rpc_commands').sendRawTransaction;
const remoteServiceErr = require('./conf/error_codes').service_unavailable;

/** Broadcast a transaction

  {
    network: <Network Name String>
    transaction: <Transaction Hex String>
  }

  @returns via cbk
  {
    transaction_id: <Transaction Id Hex String>
  }
*/
module.exports = ({network, transaction}, cbk) => {
  const params = transaction;

  return chainRpc({cmd, network, params}, (err, transactionId) => {
    if (!!err) {
      return cbk(err);
    }

    // Exit early when a transaction id was not returned, indicating failure.
    if (!transactionId) {
      return cbk([
        remoteServiceErr,
        'TransactionBroadcastFailed',
        transaction,
      ]);
    }

    return cbk(null, {transaction_id: transactionId});
  });
};

