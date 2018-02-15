const chainRpc = require('node-bitcoin-rpc');

const chainServer = require('./../conf/chain_server');

const credentials = {
  host: {
    regtest: chainServer.rpc_host,
    testnet: '127.0.0.1',
  },
  pass: {
    regtest: chainServer.rpc_pass,
    testnet: process.env.OCW_CHAIN_RPC_PASS
  },
  port: {
    regtest: chainServer.rpc_port,
    testnet: 18332,
  },
  user: {
    regtest: chainServer.rpc_user,
    testnet: 'bitcoinrpc',
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
    return cbk([0, 'Expected network']);
  }

  const host = credentials.host[args.network];
  const pass = credentials.pass[args.network];
  const port = credentials.port[args.network];
  const user = credentials.user[args.network];

  chainRpc.init(host, port, user, pass);

  return chainRpc.call(args.cmd, args.params || [], (err, r) => {
    if (!!err) {
      return cbk([0, 'Error with RPC command', err]);
    }

    return cbk(null, r.result);
  });
};

