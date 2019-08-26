const EventEmitter = require('events');

const asyncAuto = require('async/auto');
const asyncEach = require('async/each');
const asyncEachSeries = require('async/eachSeries');
const asyncFilter = require('async/filter');
const asyncMap = require('async/map');
const asyncMapSeries = require('async/mapSeries');
const asyncForever = require('async/forever');
const difference = require('lodash/difference');

const {getJsonFromCache} = require('./../cache');
const getPastBlocks = require('./get_past_blocks');
const {getRecentChainTip} = require('./../blocks');
const {setJsonInCache} = require('./../cache');

const currentBlockHash = {};
const emitDelayMs = 10;
const pollingDelayMs = 5000;
const priority = 0;

/** Poll the chain for blocks. Transactions in blocks are emitted.

  When a new block comes in, the listener will also go get past blocks and
  re-emit their transaction ids as well.

  The memory cache type may only be used with regtest

  {
    cache: <Cache Type String> 'dynamodb|memory|redis'
    network: <Network Name String>
  }

  @throws
  <Error> on invalid arguments

  @returns
  <EventEmitter Object>

  @event 'error'
  <Error Object> - this indicates the block listener is broken

  @event 'transaction'
  {
    block: <Block Hash String>
    id: <Transaction Id Hex String>
  }
*/
module.exports = ({cache, network}) => {
  if (!cache) {
    throw new Error('ExpectedCacheForBlockListener');
  }

  if (!network) {
    throw new Error('ExpectedNetworkNameForBlockListener');
  }

  const listener = new EventEmitter();

  asyncForever(cbk => {
    return asyncAuto({
      // Get the current hash
      getCurrentHash: cbk => getRecentChainTip({network, priority}, cbk),

      // When we discover a new current hash, pull transaction ids from blocks
      getPastBlocks: ['getCurrentHash', ({getCurrentHash}, cbk) => {
        // Exit early when the current hash is the same as before
        if (currentBlockHash[network] === getCurrentHash.hash) {
          return cbk();
        }

        currentBlockHash[network] = getCurrentHash.hash;

        return getPastBlocks({network, current: getCurrentHash.hash}, cbk);
      }],

      // Look in transaction ids to see if we have any special ones
      getInterestingTx: ['getPastBlocks', ({getPastBlocks}, cbk) => {
        if (!getPastBlocks) {
          return cbk();
        }

        const txIds = [];

        getPastBlocks.blocks.forEach(block => {
          return block.transaction_ids.forEach(id => {
            return txIds.push({block: block.id, id});
          });
        });

        return asyncFilter(txIds, (id, cbk) => {
          return getJsonFromCache({
            cache: 'memory',
            key: [network, id].join(),
            type: 'swap_transaction_id',
          },
          (err, res) => {
            if (!!err) {
              return cbk(err);
            }

            return cbk(null, !!res && !!res.id);
          });
        },
        cbk);
      }],

      // Tell subscribers about recent transaction ids
      emitTransactions: [
        'getCurrentHash',
        'getInterestingTx',
        'getPastBlocks',
        ({emitTransactions, getInterestingTx, getPastBlocks}, cbk) =>
      {
        if (!getPastBlocks) {
          return cbk(null, []);
        }

        getInterestingTx.forEach(({block, id}) => {
          return listener.emit('transaction', {block, id});
        });

        return asyncMapSeries(getPastBlocks.blocks, (block, cbk) => {
          return asyncEachSeries(block.transaction_ids, (id, cbk) => {
            listener.emit('transaction', {id, block: block.id});

            return setTimeout(() => cbk(), emitDelayMs);
          },
          err => {
            if (!!err) {
              return cbk(err);
            }

            return cbk(null, {id: block.id});
          });
        },
        cbk);
      }],

      // Wait a bit before triggering another poll
      delayForNextPoll: ['emitTransactions', ({emitTransactions}, cbk) => {
        return setTimeout(cbk, pollingDelayMs);
      }],
    },
    cbk);
  },
  err => {
    listener.emit('error', err);

    return;
  });

  return listener;
};

