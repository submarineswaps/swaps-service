const asyncQueue = require('async/queue');

const chainRpc = require('./chain_rpc');

const maxSimultaneousChainRpcCalls = 1;
let queue;

/** Get the chain RPC queue. This is a queue that rate-limits RPC calls.

  {}

  @returns
  <Queue Object>
*/
module.exports = ({}) => {
  if (!!queue) {
    return queue;
  }

  queue = asyncQueue(({cmd, network, params}, cbk) => {
    return chainRpc({cmd, network, params}, cbk);
  },
  maxSimultaneousChainRpcCalls);

  return queue;
};

