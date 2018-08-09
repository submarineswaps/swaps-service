const chainQueue = require('./chain_queue');

/** Call the chain RPC but in a way that will be queued

  {
    cmd: <Chain RPC Command String>
    network: <Network Name String>
    [params]: <RPC Arguments Array>
    [priority]: <Priority Number>
  }

  @returns via cbk
  <Result Object>
*/
module.exports = ({cmd, network, params, priority}, cbk) => {
  const queue = chainQueue({});

  const order = priority === undefined ? queue.length() : priority;

  return queue.push({cmd, network, params}, order, cbk);
};

