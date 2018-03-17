const chainRpc = require('./chain_rpc');

const {getRawTransaction} = require('./conf/rpc_commands');

/** Get a raw transaction

  {
    network: <Network Name String>
    transaction_id: <Transaction Id String>
  }

  @returns via cbk
  {
    [transaction]: <Transaction Hex String>
  }
*/
module.exports = (args, cbk) => {
  if (!args.network) {
    return cbk([500, 'ExpectedNetwork']);
  }

  if (!args.transaction_id) {
    return cbk([500, 'ExpectedTransactionId']);
  }

  return chainRpc({
    cmd: getRawTransaction,
    network: args.network,
    params: [args.transaction_id],
  },
  (err, transaction) => {
    if (!!err) {
      return cbk(err);
    }

    return cbk(null, {transaction});
  });
};

