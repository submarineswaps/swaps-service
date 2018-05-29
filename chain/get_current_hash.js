const chainRpc = require('./chain_rpc');
const {getBestBlockHash} = require('./conf/rpc_commands');

/** Get the block hash of the current best chain tip

  {
    network: <Network Name String>
  }

  @returns via cbk
  {
    current_hash: <Block Hash Hex String>
  }
*/
module.exports = ({network}, cbk) => {
  return chainRpc({network, cmd: getBestBlockHash}, (err, currentHash) => {
    if (!!err) {
      return cbk(err);
    }

    return cbk(null, {current_hash: currentHash});
  });
};

