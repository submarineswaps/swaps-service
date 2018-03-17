const asyncAuto = require('async/auto');

const chainRpc = require('./chain_rpc');

const {getBestBlockHash} = require('./conf/rpc_commands');
const {getBlockCount} = require('./conf/rpc_commands');

/** Get info about the best chain

  {
    network: <Network Name String>
  }

  @returns via cbk
  {
    current_hash: <Block Hash Hex String>
    current_height: <Block Height Number>
  }
*/
module.exports = ({network}, cbk) => {
  return asyncAuto({
    // Determine the current chain tip hash
    getCurrentHash: cbk => chainRpc({network, cmd: getBestBlockHash}, cbk),

    // Determine the current chain tip height
    getCurrentHeight: cbk => chainRpc({network, cmd: getBlockCount}, cbk),
  },
  (err, {getCurrentHash, getCurrentHeight}) => {
    if (!!err) {
      return cbk(err);
    }

    return cbk(null, {
      current_hash: getCurrentHash,
      current_height: getCurrentHeight,
    });
  });
};

