const asyncAuto = require('async/auto');
const {returnResult} = require('asyncjs-util');

const {Block} = require('./../tokenslib');
const {getFullBlock} = require('./../chain');
const {getJsonFromCache} = require('./../cache');
const {getTransaction} = require('./../chain');
const {setJsonInCache} = require('./../cache');

const cacheResultMs = 1000 * 60 * 5;
const lastBlock = {};
const typeBlock = 'get_transaction_block';
const typeTx = 'get_transaction_tx';
const txForBlock = {};

/** Get a raw transaction, with an optional cached result

  {
    [block]: <Block Hash Hex String>
    [cache]: <Cache Type String>
    id: <Transaction Id String>
    network: <Network Name String>
  }

  @returns via cbk
  {
    [transaction]: <Transaction Hex String>
  }
*/
module.exports = ({block, cache, id, network}, cbk) => {
  return new Promise((resolve, reject) => {
    return asyncAuto({
      // Check arguments
      validate: cbk => {
        if (!id) {
          return cbk([400, 'ExpectedIdForTransaction']);
        }

        if (!network) {
          return cbk([400, 'ExpectedNetworkToLookForTransaction']);
        }

        return cbk();
      },

      // Get the cached transaction
      getCachedTx: ['validate', ({}, cbk) => {
        // Exit early when a block is provided or there is no cache
        if (!!block || !cache) {
          return cbk();
        }

        return getJsonFromCache({cache, key: id, type: typeTx}, cbk);
      }],

      // Get the cached block
      getCachedBlock: ['getCachedTx', ({getCachedTx}, cbk) => {
        if (!block || !cache) {
          return cbk();
        }

        if (!!getCachedTx && !!getCachedTx.transaction) {
          return cbk();
        }

        lastBlock[network] = lastBlock[network] || {};

        if (lastBlock[network].id === block && !!lastBlock[network].block) {
          return cbk(null, {block: lastBlock[network].block});
        }

        // Last block doesn't match the block we're looking at, wipe "lastBlock"
        lastBlock[network] = {};

        return getJsonFromCache({
          cache: 'memory',
          key: block,
          type: typeBlock,
        },
        cbk);
      }],

      // Get a fresh block
      getFreshBlock: ['getCachedBlock', ({getCachedBlock}, cbk) => {
        if (!block || (!!getCachedBlock && getCachedBlock.block)) {
          return cbk();
        }

        return getFullBlock({network, id: block}, cbk);
      }],

      // Get a fresh transaction
      getFreshTx: ['getCachedTx', ({getCachedTx}, cbk) => {
        if (!!block || (!!getCachedTx && !!getCachedTx.transaction)) {
          return cbk();
        }

        return getTransaction({id, network}, cbk);
      }],

      // Set the cached block into the cache
      setCachedBlock: [
        'getCachedBlock',
        'getFreshBlock',
        ({getCachedBlock, getFreshBlock}, cbk) =>
      {
        // Exit early when we already have a cached value
        if (!!getCachedBlock && !!getCachedBlock.block) {
          return cbk();
        }

        // Exit early when we don't have a fresh block or cache
        if (!cache || !getFreshBlock || !getFreshBlock.block) {
          return cbk();
        }

        return setJsonInCache({
          cache: 'memory',
          key: block,
          ms: cacheResultMs,
          type: typeBlock,
          value: {block: getFreshBlock.block},
        },
        cbk);
      }],

      // Set the fresh transaction result into the cache
      setCachedTx: [
        'getCachedTx',
        'getFreshTx',
        ({getCachedTx, getFreshTx}, cbk) =>
      {
        // Exit early when this is an in-block lookup or there's no cache set
        if (!!block || !cache) {
          return cbk();
        }

        // Exit early when we already have a cached value
        if (!!getCachedTx && !!getCachedTx.transaction) {
          return cbk()
        }

        // Exit early when the transaction was not found
        if (!getFreshTx || !getFreshTx.transaction) {
          return cbk();
        }

        return setJsonInCache({
          cache,
          key: id,
          ms: cacheResultMs,
          type: typeTx,
          value: {transaction: getFreshTx.transaction},
        },
        cbk);
      }],

      // Transaction found in block
      txInBlock: [
        'getCachedBlock',
        'getFreshBlock',
        ({getCachedBlock, getFreshBlock}, cbk) =>
      {
        const result = getFreshBlock || getCachedBlock;
        let transactions = {};

        // Exit early when there's no block result to look for a tx in
        if (!block || !result || !result.block) {
          return cbk();
        }

        const hexBlock = result.block;

        lastBlock[network] = {block: hexBlock, id: block};

        if (!!txForBlock[network] && txForBlock[network].block === block) {
          transactions = txForBlock[network].transactions;
        } else {
          try {
            Block.fromHex(hexBlock).transactions
              .forEach(t => transactions[t.getId()] = t);
          } catch (err) {
            return cbk([503, 'FailedToParseHexBlock', err]);
          }

          txForBlock[network] = {block, transactions};
        }

        const tx = transactions[id];

        if (!tx) {
          return cbk([400, 'TransactionNotFoundInBlock']);
        }

        return cbk(null, tx.toHex());
      }],

      // Final result
      result: [
        'getCachedTx',
        'getFreshTx',
        'txInBlock',
        ({getCachedTx, getFreshTx, txInBlock}, cbk) =>
      {
        if (!!txInBlock) {
          return cbk(null, {transaction: txInBlock});
        } else {
          const {transaction} = getFreshTx || getCachedTx;

          return cbk(null, {transaction});
        }
      }],
    },
    returnResult({reject, resolve, of: 'result'}, cbk));
  });
};
