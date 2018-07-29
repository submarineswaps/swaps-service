const chainRpc = require('./call_chain_rpc');
const {getBlock} = require('./conf/rpc_commands');

const cmd = getBlock;
const returnRaw = false;

/** Get block transaction ids and previous block pointer

  {
    id: <Block Hash Hex String>
    network: <Network Name String>
  }

  @returns via cbk
  {
    [block]: <Raw Block Hex String>
  }
*/
module.exports = ({id, network}, cbk) => {
  return chainRpc({cmd, network, params: [id, returnRaw]}, (err, block) => {
    if (!!err) {
      return cbk(err);
    }

    return cbk(null, {block});
  });
};

