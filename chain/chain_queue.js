const asyncPriorityQueue = require('async/priorityQueue');

const chainRpc = require('./chain_rpc');

const maxSimultaneousChainRpcCalls = 2;
const queues = {};

/** Get the chain RPC queue. This is a queue that rate-limits RPC calls.

  {
    network: <Network Queue>
  }

  @returns
  <Queue Object>
*/
module.exports = ({network}) => {
  // Exit early when there is already a queue
  if (!!queues[network]) {
    return queues[network];
  }

  queues[network] = asyncPriorityQueue(({cmd, network, params}, cbk) => {
    return chainRpc({cmd, network, params}, cbk);
  },
  maxSimultaneousChainRpcCalls);

  return queues[network];
};

