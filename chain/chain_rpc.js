const chainRpc = require('node-bitcoin-rpc');

const {regtest} = require('./conf/chain_server');
const errCode = require('./conf/error_codes');

const {SSS_CHAIN_RPC_HOST} = process.env;
const {SSS_CHAIN_RPC_PASS} = process.env;
const {SSS_CHAIN_RPC_USER} = process.env;

const [regtestRpcHost, regtestRpcPort] = regtest.rpc_host.split(':');
const regtestRpcPass = regtest.rpc_pass;
const regtestRpcUser = regtest.rpc_user;
const stopAfterErrorsMs = 3000;
const [testnetRpcHost, testnetRpcPort] = (SSS_CHAIN_RPC_HOST || '').split(':');
const testnetRpcPass = SSS_CHAIN_RPC_PASS;
const testnetRpcUser = SSS_CHAIN_RPC_USER || 'bitcoinrpc';

const credentials = {
  host: {regtest: regtestRpcHost, testnet: testnetRpcHost},
  pass: {regtest: regtestRpcPass, testnet: testnetRpcPass},
  port: {regtest: regtestRpcPort, testnet: testnetRpcPort},
  user: {regtest: regtestRpcUser, testnet: testnetRpcUser},
};

let pauseOnErrorDate;

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
  if (new Date() < pauseOnErrorDate) {
    return cbk([503, 'ChainRpcError']);
  }

  let count = 0;

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
    if (!!count++) {
      return;
    }

    if (!!err) {
      pauseOnErrorDate = new Date(Date.now() + stopAfterErrorsMs);

      return cbk([errCode.service_unavailable, 'ChainDaemonError', err]);
    }

    if (!response) {
      return cbk([errCode.service_unavailable, 'BadChainResponse']);
    }

    return cbk(null, response.result);
  });
};

