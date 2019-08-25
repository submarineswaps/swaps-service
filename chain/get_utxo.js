const asyncAuto = require('async/auto');
const {returnResult} = require('asyncjs-util');

const chainRpc = require('./call_chain_rpc');
const {getUtxo} = require('./conf/rpc_commands');

/** Get unspent transaction output

  {
    id: <Transaction Id String>
    network: <Network Name String>
    vout: <Transaction Vout Number>
  }

  @returns via cbk or Promise
  {
    [utxo]: {
      [conf_count]: <Confirmations Count Number>
    }
  }
*/
module.exports = ({id, network, vout}, cbk) => {
  return new Promise((resolve, reject) => {
    return asyncAuto({
      // Check arguments
      validate: cbk => {
        if (!id) {
          return cbk([400, 'ExpectedTransactionIdForUtxoDetails']);
        }

        if (!network) {
          return cbk([400, 'ExpectedNetworkToLookForUtxoDetails']);
        }

        if (vout === undefined) {
          return cbk([400, 'ExpectedOutputIndexToLookForUtxoDetails']);
        }

        return cbk();
      },

      // Get utxo
      getUtxo: ['validate', ({}, cbk) => {
        return chainRpc({
          network,
          cmd: getUtxo,
          params: [id, vout, false],
        },
        (err, utxo) => {
          if (!!err) {
            return cbk(err);
          }

          if (!utxo) {
            return cbk(null, {});
          }

          return cbk(null, {utxo: {conf_count: utxo.confirmations}});
        });
      }],
    },
    returnResult({reject, resolve, of: 'getUtxo'}, cbk));
  });
};
