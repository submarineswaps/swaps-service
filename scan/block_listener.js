const EventEmitter = require('events');

const asyncAuto = require('async/auto');
const asyncForever = require('async/forever');
const difference = require('lodash/difference');

const {getCurrentHash} = require('./../chain');
const getPastBlocks = require('./get_past_blocks');

const notFound = -1;
const pollingDelayMs = 1000;

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
  if (!cache || ['dynamodb', 'memory', 'redis'].indexOf(cache) === notFound) {
    throw new Error('ExpectedCacheStrategy');
  }

  if (!network) {
    throw new Error('ExpectedNetworkName');
  }

  let bestBlockHash;
  let ids = [];
  const listener = new EventEmitter();

  asyncForever(cbk => {
    return asyncAuto({
      // Get the current hash
      getCurrentHash: cbk => getCurrentHash({network}, cbk),

      // When we discover a new current hash, pull transaction ids from blocks
      getPastBlocks: ['getCurrentHash', ({getCurrentHash}, cbk) => {
        const current = getCurrentHash.hash;

        // Exit early with nothing when the best block has not changed
        if (current === bestBlockHash) {
          return cbk(null, []);
        }

        return getPastBlocks({cache, current, network}, cbk);
      }],

      // Tell subscribers about the recent transaction ids
      emitTransactions: ['getCurrentHash', 'getPastBlocks', (res, cbk) => {
        const blockForTransaction = {};
        const {blocks} = res.getPastBlocks;
        const freshIds = [];

        blocks.forEach(block => {
          return block.transaction_ids.forEach(id => {
            blockForTransaction[id] = block;

            return freshIds.push(id);
          });
        });

        difference(freshIds, ids).forEach(id => {
          const block = blockForTransaction[id].id;

          return listener.emit('transaction', {block, id});
        });

        ids = freshIds;

        // Set the current hash as fully published
        bestBlockHash = res.getCurrentHash;

        return cbk();
      }],

      // Wait a bit before triggering another poll
      delayForNextPoll: ['emitTransactions', ({}, cbk) => {
        return setTimeout(cbk, pollingDelayMs);
      }],
    },
    cbk);
  },
  err => listener.emit('error', err));

  return listener;
};

