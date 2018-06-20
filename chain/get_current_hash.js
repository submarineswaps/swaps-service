const chainRpc = require('./call_chain_rpc');
const {getBestBlockHash} = require('./conf/rpc_commands');

/** Get the block hash of the current best chain tip

  {
    network: <Network Name String>
  }

  @returns via cbk
  {
    hash: <Block Hash Hex String>
  }
*/
module.exports = ({network}, cbk) => {
  return chainRpc({network, cmd: getBestBlockHash}, (err, hash) => {
    if (!!err) {
      return cbk(err);
    }

    return cbk(null, {hash});
  });
};

