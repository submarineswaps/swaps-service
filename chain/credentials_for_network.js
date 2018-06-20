const {URL} = require('url');

const chains = require('./conf/chains');
const chainServer = require('./conf/chain_server_defaults');

const decBase = 10;
const {SSS_CHAIN_LTCTESTNET_RPC_API} = process.env;
const {SSS_CHAIN_TESTNET_RPC_API} = process.env;

/** Get credentials for a given network's chain daemon

  {
    network: <Network Name String>
  }

  @throws
  <Error> when arguments are invalid

  @returns
  {
    host: <Host Address String>
    pass: <Password String>
    port: <Daemon Port Number>
    user: <Username String>
  }
*/
module.exports = ({network}) => {
  if (!network) {
    throw new Error('ExpectedNetworkForCredentials');
  }

  const service = chainServer[network];

  if (!service) {
    throw new Error('CredentialsUnknownForUnknownNetwork');
  }

  let api;

  switch (network) {
  case (chains.bitcoin_testnet):
    api = SSS_CHAIN_TESTNET_RPC_API || service.rpc_api;
    break;

  case (chains.litecoin_testnet):
    api = SSS_CHAIN_LTCTESTNET_RPC_API || service.rpc_api;
    break;

  default:
    api = service.rpc_api;
    break;
  }

  // For parsing purposes, construct a dummy URL from the API value
  const url = new URL(`http://${api}`);

  if (!url.port) {
    throw new Error('MissingPortForChainApi');
  }

  return {
    host: url.hostname,
    pass: url.password,
    port: parseInt(url.port, decBase),
    user: url.username,
  };
};

