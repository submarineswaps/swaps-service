const asyncAuto = require('async/auto');
const {returnResult} = require('asyncjs-util');

const {broadcastTransaction} = require('./../chain');
const {getRecentChainTip} = require('./../blocks');
const {Transaction} = require('./../tokenslib');

/** Send a raw transaction to the network

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
    // Check the chain tip
    getChainTip: cbk => getRecentChainTip({network}, cbk),

    // Check arguments
    validate: cbk => {
      if (!network) {
        return cbk([400, 'ExpectedNetworkForTransactionBroadcast']);
      }

      if (!transaction) {
        return cbk([400, 'ExpectedTransactionToBroadcast']);
      }

      return cbk();
    },

    // Check the lock time on the transaction to make sure it's current
    checkLockTime: ['getChainTip', 'validate', ({getChainTip}, cbk) => {
      try {
        const {locktime} = Transaction.fromHex(transaction);

        if (locktime > getChainTip.height) {
          return cbk([400, 'ChainHeightNotReached']);
        }

        return cbk();
      } catch (err) {
        return cbk([400, 'FailedToDeriveTransactionDetails']);
      }
    }],

    // Send transaction
    broadcast: ['checkLockTime', ({}, cbk) => {
      return broadcastTransaction({network, transaction}, cbk);
    }],
  },
  returnResult({of: 'broadcast'}, cbk));
};

