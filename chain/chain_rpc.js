const asyncQueue = require('async/queue');
const asyncRetry = require('async/retry');

const credentialsForNetwork = require('./credentials_for_network');
const rpc = require('./rpc');

const chainTimeoutMs = 3000;
const interval = retryCount => 50 * Math.pow(2, retryCount); // Retry backoff
const times = 5; // Retry count.

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
    return cbk([500, 'FailedToGetCredentials', e]);
  }

  const {host} = credentials;
  const {pass} = credentials;
  const {port} = credentials;
  const {user} = credentials;

  const chainRpc = require('node-bitcoin-rpc');

  chainRpc.init(host, port, user, pass);
  chainRpc.setTimeout(chainTimeoutMs);

  // Should the params be a single argument instead of array, array-ize it.
  const niceParams = !Array.isArray(params || []) ? [params] : params || [];

  // On errors the queue issues a second callback, called avoids multiple cbks.
  let called = false;

  return asyncRetry({interval, times}, cbk => {
    return rpc({
      cmd,
      host,
      pass,
      port,
      user,
      params: niceParams,
      timeout: chainTimeoutMs,
    },
    (err, response) => {
      if (!response) {
        return cbk([503, 'ExpectedNonEmptyChainResponse', cmd, network]);
      }

      return cbk(null, response.result);
    });
  },
  (err, res) => {
    if (!!called) {
      return;
    }

    called = true;

    if (!!err) {
      return cbk(err);
    }

    return cbk(null, res);
  });
};

