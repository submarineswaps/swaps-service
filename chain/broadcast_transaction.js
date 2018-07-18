const asyncAuto = require('async/auto');

const chainRpc = require('./call_chain_rpc');
const {getRawTransaction} = require('./conf/rpc_commands');
const {sendRawTransaction} = require('./conf/rpc_commands');
const {returnResult} = require('./../async-util');

const broadcastDelayMs = 300;

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
  return asyncAuto({
    // Check arguments
    validate: cbk => {
      if (!network) {
        return cbk([400, 'ExpectedNetworkForTransactionBroadcast']);
      }

      if (!transaction) {
        return cbk([400, 'ExpectedNetworkToBroadcastTransaction']);
      }

      return cbk();
    },

    // Broadcast transaction
    broadcast: ['validate', ({}, cbk) => {
      const cmd = sendRawTransaction;
      const params = transaction;

      return chainRpc({cmd, network, params}, (err, id) => {
        if (!!err) {
          return cbk(err);
        }

        // Exit early when an id was not returned, indicating failure.
        if (!id) {
          return cbk([503, 'TransactionBroadcastFailed', transaction]);
        }

        // Delay a little bit to allow transaction to percolate
        return setTimeout(() => cbk(null, {id}), broadcastDelayMs);
      });
    }],

    // Check that the transaction is known
    checkBroadcast: ['broadcast', ({broadcast}, cbk) => {
      const cmd = getRawTransaction;
      const params = [broadcast.id];

      return chainRpc({cmd, network, params}, (err, tx) => {
        if (!!err) {
          return cbk(err);
        }

        if (tx !== transaction) {
          return cbk([503, 'TransactionBroadcastFailed', tx, transaction]);
        }

        return cbk();
      });
    }],
  },
  returnResult({of: 'broadcast'}, cbk));
};

