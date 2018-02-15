const chainRpc = require('./chain_rpc');

const stop = require('./../conf/rpc_commands').stop;

/** Stop the chain daemon

  {
    network: <Network Name String>
  }
*/
module.exports = (args, cbk) => {
  return chainRpc({cmd: stop, network: args.network}, cbk);
};

