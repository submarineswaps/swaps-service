const chainRpc = require('./chain_rpc');

const {getRawTransaction} = require('./conf/rpc_commands');

/** Get a raw transaction

  {
    id: <Transaction Id String>
    network: <Network Name String>
  }

  @returns via cbk
  {
    [transaction]: <Transaction Hex String>
  }
*/
module.exports = ({id, network}, cbk) => {
  if (!id) {
    return cbk([500, 'ExpectedIdForTransaction']);
  }

  if (!network) {
    return cbk([500, 'ExpectedNetworkToLookForTransaction']);
  }

  return chainRpc({
    network,
    cmd: getRawTransaction,
    params: [id],
  },
  (err, transaction) => {
    if (!!err) {
      return cbk(err);
    }

    return cbk(null, {transaction});
  });
};

