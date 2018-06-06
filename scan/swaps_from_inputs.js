const asyncAuto = require('async/auto');
const asyncMap = require('async/map');
const {Transaction} = require('bitcoinjs-lib');

const getSwapKeyIndex = require('./get_swap_key_index');
const {returnResult} = require('./../async-util');
const swapResolutions = require('./../swaps/swap_resolutions');

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
      outpoint: <Spent Outpoint String>
      [preimage]: <Preimage Hex String>
      script: <Redeem Script Hex String>
      type: <Swap Type String> 'claim|refund'
    }]
  }
*/
module.exports = ({cache, transaction}, cbk) => {
  return asyncAuto({
    // Transaction id for swap
    id: cbk => {
      try {
        return cbk(null, Transaction.fromHex(transaction).getId());
      } catch (e) {
        return cbk([400, 'ExpectedValidTransactionHex', e]);
      }
    },

    // Check arguments
    validate: cbk => {
      if (!cache) {
        return cbk([400, 'ExpectedCacheTypeForCheckCaching']);
      }

      if (!transaction) {
        return cbk([400, 'ExpectedTransactionHex']);
      }

      return cbk();
    },

    // Derive swap resolutions related to the transaction
    swaps: ['validate', ({}, cbk) => {
      try {
        return cbk(null, swapResolutions({transaction}).resolutions);
      } catch (e) {
        return cbk([500, 'FailedToDeriveSwapResolutions', e]);
      }
    }],

    // Find key ids for swaps
    foundSwaps: ['id', 'swaps', ({id, swaps}, cbk) => {
      return asyncMap(swaps, ({outpoint, preimage, script, type}, cbk) => {
        return getSwapKeyIndex({cache, script}, (err, res) => {
          if (!!err) {
            return cbk(err);
          }
          if (!res || res.index === undefined) {
            return cbk();
          }

          const {index} = res;

          return cbk(null, {id, index, outpoint, preimage, script, type});
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

