const chainRpc = require('./chain_rpc');

const stop = require('./../conf/rpc_commands').stop;

/** Stop the chain daemon

  {}
*/
module.exports = (args, cbk) => {
  return chainRpc({cmd: stop}, cbk);
};

