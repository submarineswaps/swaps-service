const chainRpc = require('./call_chain_rpc');

const {stop} = require('./conf/rpc_commands');

/** Stop the chain daemon

  {
    network: <Network Name String>
  }
*/
module.exports = ({network}, cbk) => {
  return chainRpc({network, cmd: stop}, cbk);
};

