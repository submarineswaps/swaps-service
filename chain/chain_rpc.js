const chainRpc = require('node-bitcoin-rpc');

const chainServer = require('./conf/chain_server');
const errCode = require('./conf/error_codes');

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
module.exports = ({cmd, network, params}, cbk) => {
  if (!network) {
    return cbk([errCode.local_err, 'ExpectedNetwork']);
  }

  const host = credentials.host[network];
  const pass = credentials.pass[network];
  const port = credentials.port[network];
  const user = credentials.user[network];

  chainRpc.init(host, port, user, pass);

  // Should the params be a single argument instead of array, array-ize it.
  const niceParams = !Array.isArray(params || []) ? [params] : params || [];

  return chainRpc.call(cmd, niceParams, (err, response) => {
    if (!!err) {
      return cbk([errCode.service_unavailable, 'ChainDaemonError', err]);
    }

    if (!response) {
      return cbk([errCode.service_unavailable, 'BadChainResponse']);
    }

    return cbk(null, response.result);
  });
};

