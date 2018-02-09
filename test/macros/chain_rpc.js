const chainRpc = require('node-bitcoin-rpc');

const chainServer = require('./../conf/chain_server');

/** Execute Chain RPC command

  {
    cmd: <Chain RPC Command String>
    [params]: <RPC Arguments Array>
  }

  @returns via cbk
  <Result Object>
*/
module.exports = (args, cbk) => {
  const host = chainServer.rpc_host;
  const pass = chainServer.rpc_pass;
  const port = chainServer.rpc_port;
  const user = chainServer.rpc_user;

  chainRpc.init(host, port, user, pass);

  return chainRpc.call(args.cmd, args.params || [], (err, r) => {
    if (!!err) {
      return cbk([0, 'Error with RPC command', err]);
    }

    return cbk(null, r.result);
  });
};

