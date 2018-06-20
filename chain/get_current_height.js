const chainRpc = require('./call_chain_rpc');
const {getBlockCount} = require('./conf/rpc_commands');

/** Get the block height of the current best chain tip

  {
    network: <Network Name String>
  }

  @returns via cbk
  {
    height: <Block Height Number>
  }
*/
module.exports = ({network}, cbk) => {
  return chainRpc({network, cmd: getBlockCount}, (err, height) => {
    if (!!err) {
      return cbk(err);
    }

    return cbk(null, {height});
  });
};

