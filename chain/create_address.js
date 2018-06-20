const chainRpc = require('./call_chain_rpc');

const {createAddress} = require('./conf/rpc_commands');

/** Create a new chain address

  {
    network: <Network Name String>
  }

  @returns via cbk
  {
    address: <Chain Address String>
  }
*/
module.exports = ({network}, cbk) => {
  return chainRpc({network, cmd: createAddress}, (err, address) => {
    if (!!err) {
      return cbk(err);
    }

    if (!address) {
      return cbk([503, 'ExpectedCreatedAddress']);
    }

    return cbk(null, {address});
  });
};

