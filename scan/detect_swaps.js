const asyncAuto = require('async/auto');

const {getJsonFromCache} = require('./../cache');
const {getTransaction} = require('./../blocks');
const {returnResult} = require('./../async-util');
const {setJsonInCache} = require('./../cache');
const swapsFromInputs = require('./swaps_from_inputs');
const swapsFromOutputs = require('./swaps_from_outputs');

const cacheSwapsMs = 1000 * 60 * 60 * 2;

/** Check a transaction to see if there are any associated swaps.

  {
    [block]: <Block Id Hex String>
    cache: <Cache Type String> 'dynamodb|memory|redis'
    id: <Transaction Id Hex String>
    network: <Network Name String>
  }

  @return via cbk
  {
    swaps: [{
      index: <Redeem Script Claim Key Index Number>
      [invoice] <Funding Related BOLT 11 Invoice String>
      [outpoint]: <Resolution Spent Outpoint String>
      [output]: <Funding Output Script Hex String>
      [preimage]: <Claim Preimage Hex String>
      script: <Swap Redeem Script Hex String>
      [tokens]: <Token Count Number>
      type: <Transaction Type String> claim|funding|refund
      [vout]: <Funding Output Index Number>
    }]
  }
*/
module.exports = ({block, cache, id, network}, cbk) => {
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

      // This will get the transaction from the chain. Avoid caching mempool
      // transactions as they could be pretty numerous.
      return getTransaction({
        block,
        id,
        network,
        cache: !block ? null : cache,
      },
      cbk);
    }],

    // Determine if the inputs have swaps. (Claim or refund type)
    swapsFromInputs: ['getTransaction', ({getTransaction}, cbk) => {
      // Exit early when there's no transaction to lookup
      if (!getTransaction) {
        return cbk();
      }

      const {transaction} = getTransaction;

      return swapsFromInputs({cache, network, transaction}, cbk);
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

      return cbk(null, [].concat(fundingSwaps).concat(resolutionSwaps));
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

