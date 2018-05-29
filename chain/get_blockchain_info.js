const asyncAuto = require('async/auto');

const chainRpc = require('./chain_rpc');

const {getBestBlockHash} = require('./conf/rpc_commands');
const {getBlockCount} = require('./conf/rpc_commands');

const cacheChainInfoMs = 5000;
const cached = {};

/** Get info about the best chain

  {
    [is_cache_ok]: <Is Cache Allowed Bool>
    network: <Network Name String>
  }

  @returns via cbk
  {
    current_hash: <Block Hash Hex String>
    current_height: <Block Height Number>
  }
*/
module.exports = (args, cbk) => {
  const {network} = args;
  const now = Date.now();

  if (!!args.is_cache_ok && (cached[network] || {}).expires_at > Date.now()) {
    return cbk(null, {
      current_hash: cached[network].current_hash,
      current_height: cached[network].current_height,
    });
  }

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

    cached[network] = {
      expires_at: Date.now() + cacheChainInfoMs,
      current_hash: getCurrentHash,
      current_height: getCurrentHeight,
    };

    return cbk(null, {
      current_hash: getCurrentHash,
      current_height: getCurrentHeight,
    });
  });
};

