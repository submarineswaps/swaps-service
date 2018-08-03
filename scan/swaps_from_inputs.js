const asyncAuto = require('async/auto');
const asyncMap = require('async/map');

const getSwapKeyIndex = require('./get_swap_key_index');
const {returnResult} = require('./../async-util');
const swapResolutions = require('./../swaps/swap_resolutions');
const {Transaction} = require('./../tokenslib');

/** Return swap transactions detected in inputs for a transaction.

  The type of swaps that can be detected in inputs are claim or refund
  transactions.

  {
    cache: <Cache Type String>
    transaction: <Transaction Hex String>
  }

  @returns via cbk
  {
    swaps: [{
      id: <Transaction Id Hex String>
      index: <Swap Key Index Number>
      invoice: <BOLT 11 Encoded Invoice Corresponding to Input String>
      outpoint: <Spent Outpoint String>
      [preimage]: <Preimage Hex String>
      script: <Redeem Script Hex String>
      type: <Swap Type String> 'claim|refund'
    }]
  }
*/
module.exports = ({cache, network, transaction}, cbk) => {
  return asyncAuto({
    // Transaction id for swap
    id: cbk => {
      if (!transaction) {
        return cbk([400, 'ExpectedTransactionHexForInputs']);
      }

      try {
        return cbk(null, Transaction.fromHex(transaction).getId());
      } catch (err) {
        return cbk([400, 'ExpectedValidTransactionHex', err]);
      }
    },

    // Check arguments
    validate: cbk => {
      if (!cache) {
        return cbk([400, 'ExpectedCacheTypeForCheckCaching']);
      }

      if (!network) {
        return cbk([400, 'ExpectedNetworkForInputSwaps']);
      }

      if (!transaction) {
        return cbk([400, 'ExpectedTransactionHex']);
      }

      return cbk();
    },

    // Derive swap resolutions related to the transaction
    swaps: ['validate', ({}, cbk) => {
      try {
        return cbk(null, swapResolutions({network, transaction}).resolutions);
      } catch (err) {
        return cbk([500, 'FailedToDeriveSwapResolutions', err]);
      }
    }],

    // Find key ids for swaps
    foundSwaps: ['id', 'swaps', ({id, swaps}, cbk) => {
      return asyncMap(swaps, ({outpoint, preimage, script, type}, cbk) => {
        return getSwapKeyIndex({cache, network, script}, (err, res) => {
          if (!!err) {
            return cbk(err);
          }

          if (!res || res.index === undefined) {
            return cbk();
          }

          const {index} = res;
          const {invoice} = res;

          return cbk(null, {
            id,
            index,
            invoice,
            outpoint,
            preimage,
            script,
            type,
          });
        });
      },
      cbk);
    }],

    // Final set of swaps, swaps where the index is known
    knownSwaps: ['foundSwaps', ({foundSwaps}, cbk) => {
      return cbk(null, {swaps: foundSwaps.filter(n => !!n)});
    }],
  },
  returnResult({of: 'knownSwaps'}, cbk));
};

