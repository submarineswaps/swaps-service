const chainRpc = require('./chain_rpc');

const cmd = require('./conf/rpc_commands').createAddress;

/** Create a new address

  {
    network: <Network Name String>
  }

  @returns via cbk
  {
    chain_address: <Chain Address String>
  }
*/
module.exports = ({network}, cbk) => {
  return chainRpc({cmd, network}, (err, chainAddress) => {
    if (!!err) {
      return cbk(err);
    }

    return cbk(null, {chain_address: chainAddress});
  });
};

