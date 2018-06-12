const EventEmitter = require('events');

const asyncAuto = require('async/auto');
const asyncForever = require('async/forever');
const difference = require('lodash/difference');

const {getMempool} = require('./../chain');

const pollingDelayMs = 1000;

/** Poll the mempool for transactions. When we find a transaction in the
    mempool, emit an event.

  {
    network: <Network Name String>
  }

  @throws
  <Error> on invalid arguments

  @returns
  <EventEmitter Object>

  @event 'transaction'
  {
    id: <Transaction Id Hex String>
  }
*/
module.exports = ({network}) => {
  if (!network) {
    throw new Error('ExpectedNetworkName');
  }

  let ids = [];
  const listener = new EventEmitter();

  asyncForever(cbk => {
    return asyncAuto({
      // Get the current mempool
      getMempool: cbk => getMempool({network}, cbk),

      // Compare the mempool's transaction against the cache
      differentIds: ['getMempool', ({getMempool}, cbk) => {
        const freshIds = getMempool.transaction_ids;

        difference(freshIds, ids).forEach(id => {
          return listener.emit('transaction', id);
        });

        ids = freshIds;

        return cbk();
      }],

      // Delay for the next poll
      delayForNextPoll: ['differentIds', ({}, cbk) => {
        return setTimeout(cbk, pollingDelayMs);
      }],
    },
    cbk);
  },
  err => listener.emit('err'));

  return listener;
};

