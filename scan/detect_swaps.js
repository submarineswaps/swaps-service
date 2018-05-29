const asyncAuto = require('async/auto');

const {getJsonFromCache} = require('./../cache');
const {getTransaction} = require('./../chain');
const {returnResult} = require('./../async-util');
const {setJsonInCache} = require('./../cache');
const swapsFromInputs = require('./swaps_from_inputs');
const swapsFromOutputs = require('./swaps_from_outputs');

const cacheSwapsMs = 1000 * 60 * 60 * 2;

/** Check a transaction to see if there are any associated swaps.

  {
    cache: <Cache Type String> 'dynamodb|memory|redis'
    id: <Transaction Id Hex String>
    network: <Network Name String>
  }

  @return via cbk
  {
    swaps: [{
      [id]: <Transaction Id Hex String>
      [index]: <Key Index Number>
      [invoice] <BOLT 11 Invoice String>
      [output]: <Output Script Hex String>
      script: <Swap Redeem Script String>
      [tokens]: <Token Count Number>
      [transaction]: <Hex Serialized Transaction String>
      type: <Transaction Type String> claim|funding|refund
    }]
  }
*/
module.exports = ({cache, id, network}, cbk) => {
  return asyncAuto({
    // Check arguments
    validate: cbk => {
      if (!cache) {
        return cbk([400, 'ExpectedCacheToCheck']);
      }

      if (!id) {
        return cbk([400, 'ExpectedTxIdToCheck']);
      }

      if (!network) {
        return cbk([400, 'ExpectedNetworkName']);
      }

      return cbk();
    },

    // See if we already know swaps related to this transaction
    getCachedSwaps: ['validate', ({}, cbk) => {
      return getJsonFromCache({cache, key: id, type: 'swaps_for_tx'}, cbk);
    }],

    // Get the raw transaction to look for swaps
    getTransaction: ['getCachedSwaps', ({getCachedSwaps}, cbk) => {
      // Exit early when we already have swap details
      if (!!getCachedSwaps) {
        return cbk();
      }

      // This will get the transaction from the chain. There's no need to cache
      // it because we are caching the end result of our analysis.
      return getTransaction({id, network}, cbk);
    }],

    // Determine if the inputs have swaps. (Claim or refund type)
    swapsFromInputs: ['getTransaction', ({getTransaction}, cbk) => {
      // Exit early when there's no transaction to lookup
      if (!getTransaction) {
        return cbk();
      }

      const {transaction} = getTransaction;

      return swapsFromInputs({cache, transaction}, cbk);
    }],

    // Determine if the outputs have swap output scripts (funding type)
    swapsFromOutputs: ['getTransaction', ({getTransaction}, cbk) => {
      // Exit early when there's no transaction to lookup
      if (!getTransaction) {
        return cbk();
      }

      const {transaction} = getTransaction;

      return swapsFromOutputs({cache, network, transaction}, cbk);
    }],

    // Concat all detected swaps
    swaps: [
      'getCachedSwaps',
      'getTransaction',
      'swapsFromInputs',
      'swapsFromOutputs',
      ({
        getCachedSwaps,
        getTransaction,
        swapsFromInputs,
        swapsFromOutputs,
      },
      cbk) =>
    {
      // Exit early when the swaps results were cached
      if (!!getCachedSwaps) {
        return cbk(null, getCachedSwaps);
      }

      const fundingSwaps = !swapsFromOutputs ? [] : swapsFromOutputs.swaps;
      const resolutionSwaps = !swapsFromInputs ? [] : swapsFromInputs.swaps;

      const swaps = fundingSwaps.concat(resolutionSwaps).map(swap => {
        swap.transaction = getTransaction.transaction;

        return swap;
      });

      return cbk(null, swaps);
    }],

    // Set cached swap status
    setCachedSwaps: ['getCachedSwaps', 'swaps', (res, cbk) => {
      // Exit early without caching when the swaps are a cached result
      if (!!res.getCachedSwaps) {
        return cbk();
      }

      return setJsonInCache({
        cache,
        key: id,
        ms: cacheSwapsMs,
        type: 'swaps_for_tx',
        value: res.swaps,
      },
      cbk);
    }],

    // Final swaps result
    detectedSwaps: ['swaps', ({swaps}, cbk) => cbk(null, {swaps})],
  },
  returnResult({of: 'detectedSwaps'}, cbk));
};

