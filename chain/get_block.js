const chainRpc = require('./call_chain_rpc');

const {getBlock} = require('./conf/rpc_commands');

const nullHash = '0000000000000000000000000000000000000000000000000000000000000000';

/** Get block

  {
    id: <Block Hash Hex String>
    network: <Network Name String>
  }

  @returns via cbk
  {
    [previous_block_hash]: <Previous Block Hash Hex String>
    transaction_ids: [<Transaction Id String>]
  }
*/
module.exports = ({id, network}, cbk) => {
  return chainRpc({
    cmd: getBlock,
    network: network,
    params: [id],
  },
  (err, block) => {
    if (!!err) {
      return cbk(err);
    }

    if (!Array.isArray(block.tx)) {
      return cbk([503, 'UnexpectedGetBlockResult']);
    }

    const isPrevNull = block.previousblockhash === nullHash;

    return cbk(null, {
      previous_block_hash: isPrevNull ? null : block.previousblockhash,
      transaction_ids: block.tx,
    });
  });
};

