const asyncAuto = require('async/auto');

const {getJsonFromCache} = require('./../cache');
const {getTransaction} = require('./../blocks');
const {returnResult} = require('./../async-util');
const {setJsonInCache} = require('./../cache');
const swapsFromInputs = require('./swaps_from_inputs');
const swapsFromOutputs = require('./swaps_from_outputs');
const {Transaction} = require('./../tokenslib');

const cacheSwapsMs = 1000 * 60 * 10;
const type = 'detect_swaps';

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

    // Cache key
    key: ['validate', ({}, cbk) => cbk(null, id)],

    // See if we already know swaps related to this transaction
    getCachedSwaps: ['key', ({key}, cbk) => {
      return getJsonFromCache({cache: 'memory', key, type}, cbk);
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

    // Parsed transaction
    tx: ['getTransaction', ({getTransaction}, cbk) => {
      // Exit early when there's no transaction to lookup
      if (!getTransaction || !getTransaction.transaction) {
        return cbk();
      }

      const {transaction} = getTransaction;

      try {
        const tx = Transaction.fromHex(transaction);

        return cbk(null, {id: tx.getId(), inputs: tx.ins, outputs: tx.outs});
      } catch (err) {
        return cbk([400, 'ExpectedValidTransactionHex', err]);
      }
    }],

    // Determine if the inputs have swaps. (Claim or refund type)
    swapsFromInputs: ['tx', ({tx}, cbk) => {
      // Exit early when there's no transaction to lookup
      if (!tx) {
        return cbk();
      }

      const {id} = tx;
      const {inputs} = tx;

      return swapsFromInputs({cache, id, inputs, network}, cbk);
    }],

    // Determine if the outputs have swap output scripts (funding type)
    swapsFromOutputs: ['tx', ({tx}, cbk) => {
      // Exit early when there's no transaction to lookup
      if (!tx) {
        return cbk();
      }

      const {id} = tx;
      const {outputs} = tx;

      const strangeOutputs = outputs.filter(({value}) => !value);

      // Ignore mempool transactions that have strange outputs
      if (!block && !!strangeOutputs.length) {
        return cbk();
      }

      return swapsFromOutputs({cache, id, network, outputs}, cbk);
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
    setCachedSwaps: [
      'getCachedSwaps',
      'key',
      'swaps',
      ({getCachedSwaps, key, swaps}, cbk) =>
    {
      // Exit early without caching when the swaps are a cached result
      if (!!getCachedSwaps) {
        return cbk();
      }

      return setJsonInCache({
        key,
        type,
        cache: 'memory',
        ms: cacheSwapsMs,
        value: swaps,
      },
      cbk);
    }],

    // Final swaps result
    detectedSwaps: ['swaps', ({swaps}, cbk) => cbk(null, {swaps})],
  },
  returnResult({of: 'detectedSwaps'}, cbk));
};

