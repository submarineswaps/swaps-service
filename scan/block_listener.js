const EventEmitter = require('events');

const asyncAuto = require('async/auto');
const asyncEach = require('async/each');
const asyncFilter = require('async/filter');
const asyncMap = require('async/map');
const asyncForever = require('async/forever');
const difference = require('lodash/difference');

const {getJsonFromCache} = require('./../cache');
const getPastBlocks = require('./get_past_blocks');
const {getRecentChainTip} = require('./../blocks');
const {setJsonInCache} = require('./../cache');

const cacheBlockEmissionMs = 1000 * 60 * 10;
const currentBlockHash = {};
const notFound = -1;
const pollingDelayMs = 3000;
const type = 'emitted_block';

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
module.exports = ({network}) => {
  if (!network) {
    throw new Error('ExpectedNetworkName');
  }

  const listener = new EventEmitter();

  asyncForever(cbk => {
    return asyncAuto({
      // Get the current hash
      getCurrentHash: cbk => getRecentChainTip({network}, cbk),

      // When we discover a new current hash, pull transaction ids from blocks
      getPastBlocks: ['getCurrentHash', ({getCurrentHash}, cbk) => {
        // Exit early when the current hash is the same as before
        if (currentBlockHash[network] === getCurrentHash.hash) {
          return cbk();
        }

        currentBlockHash[network] = getCurrentHash.hash;

        return getPastBlocks({network, current: getCurrentHash.hash}, cbk);
      }],

      // Get blocks that were already emitted
      getEmittedBlocks: ['getPastBlocks', ({getPastBlocks}, cbk) => {
        if (!getPastBlocks) {
          return cbk();
        }

        return asyncMap(getPastBlocks.blocks, ({id}, cbk) => {
          return getJsonFromCache({
            type,
            cache: 'memory',
            key: [id, network].join(),
          },
          cbk);
        },
        cbk);
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
        'getEmittedBlocks',
        'getInterestingTx',
        'getPastBlocks',
        ({
          emitTransactions,
          getEmittedBlocks,
          getInterestingTx,
          getPastBlocks,
        },
        cbk) =>
      {
        if (!getPastBlocks) {
          return cbk(null, []);
        }

        const emitted = {};

        getEmittedBlocks.filter(n => !!n).forEach(({id}) => emitted[id] = id);

        const newBlocks = getPastBlocks.blocks.filter(({id}) => !emitted[id]);

        newBlocks.forEach(block => {
          return block.transaction_ids.forEach(id => {
            return listener.emit('transaction', {id, block: block.id});
          });
        });

        getInterestingTx.forEach(({block, id}) => {
          return listener.emit('transaction', {block, id});
        });

        return cbk(null, newBlocks);
      }],

      // Cache the fact that block transactions were already emitted
      setBlocksAsEmitted: ['emitTransactions', ({emitTransactions}, cbk) => {
        return asyncEach(emitTransactions, ({id}, cbk) => {
          return setJsonInCache({
            type,
            cache: 'memory',
            key: [id, network].join(),
            ms: cacheBlockEmissionMs,
            value: {id}
          },
          cbk);
        },
        cbk);
      }],

      // Wait a bit before triggering another poll
      delayForNextPoll: [
        'getCurrentHash',
        'setBlocksAsEmitted',
        ({getCurrentHash}, cbk) =>
      {
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

