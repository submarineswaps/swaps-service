const chainRpc = require('./chain_rpc');

const {getBlock} = require('./conf/rpc_commands');

/** Get block

  {
    block_hash: <Block Hash Hex String>
    network: <Network Name String>
  }

  @returns via cbk
  {
    previous_block_hash: <Previous Block Hash Hex String>
    transaction_ids: [<Transaction Id String>]
  }
*/
module.exports = (args, cbk) => {
  return chainRpc({
    cmd: getBlock,
    network: args.network,
    params: [args.block_hash],
  },
  (err, block) => {
    if (!!err) {
      return cbk(err);
    }

    return cbk(null, {
      previous_block_hash: block.previousblockhash,
      transaction_ids: block.tx,
    });
  });
};

