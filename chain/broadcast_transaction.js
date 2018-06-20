const chainRpc = require('./call_chain_rpc');

const {sendRawTransaction} = require('./conf/rpc_commands');

/** Broadcast a transaction

  {
    network: <Network Name String>
    transaction: <Transaction Hex String>
  }

  @returns via cbk
  {
    id: <Transaction Id Hex String>
  }
*/
module.exports = ({network, transaction}, cbk) => {
  const cmd = sendRawTransaction;
  const params = transaction;

  return chainRpc({cmd, network, params}, (err, id) => {
    if (!!err) {
      return cbk(err);
    }

    // Exit early when a transaction id was not returned, indicating failure.
    if (!id) {
      return cbk([503, 'TransactionBroadcastFailed', transaction]);
    }

    return cbk(null, {id});
  });
};

