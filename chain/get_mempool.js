const chainRpc = require('./call_chain_rpc');
const {getRawMempool} = require('./conf/rpc_commands');
const {take} = require('lodash');

const {isArray} = Array;
const maxMempoolIds = 3000;

/** Get the current mempool

  {
    network: <Network Name String>
  }

  @returns via cbk
  {
    transaction_ids: [<Transaction Id String>]
  }
*/

module.exports = ({network}, cbk) => {
  return chainRpc({network, cmd: getRawMempool}, (err, ids) => {
    if (!!err) {
      return cbk(err);
    }

    if (!isArray(ids)) {
      return cbk([503, 'ExpectedTransactionIds']);
    }

    return cbk(null, {transaction_ids: take(ids, maxMempoolIds)});
  });
};
