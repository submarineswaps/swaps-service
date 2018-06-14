const asyncQueue = require('async/queue');
const chainRpc = require('node-bitcoin-rpc');

const credentialsForNetwork = require('./credentials_for_network');

const chainTimeoutMs = 3000;
let pauseOnErrorDate;
const stopAfterErrorsMs = 3000;

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
    return cbk([400, 'ExpectedNetwork']);
  }

  let credentials;

  try {
    credentials = credentialsForNetwork({network});
  } catch (e) {
    return cbk([500, 'FailedToGetCredentials']);
  }

  const {host} = credentials;
  const {pass} = credentials;
  const {port} = credentials;
  const {user} = credentials;

  chainRpc.init(host, port, user, pass);
  chainRpc.setTimeout(chainTimeoutMs);

  // Should the params be a single argument instead of array, array-ize it.
  const niceParams = !Array.isArray(params || []) ? [params] : params || [];

  try {
    return chainRpc.call(cmd, niceParams, (err, response) => {
      if (!response) {
        return cbk([503, 'BadChainResponse']);
      }

      return cbk(null, response.result);
    });
  } catch (e) {
    return cbk([500, 'FailedToCallChainRpc', e]);
  }
};

