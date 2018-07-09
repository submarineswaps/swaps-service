const {spawn} = require('child_process');

const credentialsForNetwork = require('./../../chain/credentials_for_network');
const rpcServerReady = /Node.is.loaded/;

/** Start a bcoin style daemon

  {
    dir: <Path to Data Directory>
    network: <Network Name String>
  }

  @returns
  <Daemon Object>

  @returns via cbk
  {
    is_ready: <Chain Daemon is Ready Bool>
  }
*/
module.exports = ({dir, network}, cbk) => {
  if (!dir) {
    return cbk([400, 'ExpectedDirectoryForDaemon']);
  }

  if (!network) {
    return cbk([400, 'ExpectedNetworkNameForDaemon']);
  }

  let networkName;

  switch (network) {
  case 'bcoinregtest':
  case 'bitcoincoreregtest':
    networkName = 'regtest';
    break;

  default:
    return cbk([400, 'UnexpectedNetworkForDaemon', network]);
  }

  let credentials;

  try {
    credentials = credentialsForNetwork({network: network});
  } catch (e) {
    return cbk([500, 'CredentialsLookupFailure', e]);
  }

  const daemon = spawn('bcoin', [
    '--api-key', credentials.pass,
    '--http-port', credentials.port,
    '--index-tx',
    '--network', networkName,
    '--prefix', dir,
  ]);

  daemon.stdout.on('data', data => {
    if (rpcServerReady.test(`${data}`)) {
      return cbk(null, {is_ready: true});
    }

    return;
  });

  return daemon;
};

