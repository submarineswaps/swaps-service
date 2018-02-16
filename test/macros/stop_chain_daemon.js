const chainRpc = require('./chain_rpc');

const {stop} = require('./../conf/rpc_commands');

/** Stop the chain daemon

  {
    network: <Network Name String>
  }
*/
module.exports = ({network}, cbk) => chainRpc({network, cmd: stop}, cbk);

