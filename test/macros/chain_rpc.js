const chainRpc = require('node-bitcoin-rpc');

const chainServer = require('./../conf/chain_server');
const errCode = require('./../conf/error_codes');

const credentials = {
  host: {
    regtest: chainServer.regtest.rpc_host,
    testnet: chainServer.testnet.rpc_host,
  },
  pass: {
    regtest: chainServer.regtest.rpc_pass,
    testnet: process.env.OCW_CHAIN_RPC_PASS
  },
  port: {
    regtest: chainServer.regtest.rpc_port,
    testnet: chainServer.testnet.rpc_port,
  },
  user: {
    regtest: chainServer.regtest.rpc_user,
    testnet: chainServer.testnet.rpc_user,
  },
};

/** Execute Chain RPC command

  {
    cmd: <Chain RPC Command String>
    network: <Network Name String>
    [params]: <RPC Arguments Array>
  }

  @returns via cbk
  <Result Object>
*/
module.exports = (args, cbk) => {
  if (!args.network) {
    return cbk([errCode.local_err, 'Expected network']);
  }

  const host = credentials.host[args.network];
  const pass = credentials.pass[args.network];
  const port = credentials.port[args.network];
  const user = credentials.user[args.network];

  chainRpc.init(host, port, user, pass);

  return chainRpc.call(args.cmd, args.params || [], (err, {result}) => {
    if (!!err) {
      return cbk([errCode.service_unavailable, 'Error with RPC command', err]);
    }

    return cbk(null, result);
  });
};

