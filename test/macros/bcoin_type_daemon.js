const {spawn} = require('child_process');

const credentialsForNetwork = require('./../../chain/credentials_for_network');
const rpcServerReady = /Node.is.loaded/;
const serverDefaults = require('./../../chain/conf/chain_server_defaults');

/** Start a bcoin style daemon

  {
    dir: <Path to Data Directory>
    network: <Network Name String>
  }

  @returns
  <Daemon Object>

  @returns via cbk
  {
    daemon: <Daemon Child Process Object>
  }
*/
module.exports = ({dir, network}, cbk) => {
  if (!dir) {
    return cbk([400, 'ExpectedDirectoryForDaemon']);
  }

  if (!network) {
    return cbk([400, 'ExpectedNetworkNameForDaemon']);
  }

  if (!serverDefaults[network]) {
    return cbk([400, 'UnexpectedNetworkForBcoinTypeDaemon', network]);
  }

  let networkName;

  switch (network) {
  case 'bcashregtest':
  case 'bcoinregtest':
    networkName = 'regtest';
    break;

  default:
    return cbk([400, 'UnexpectedNetworkForDaemon', network]);
  }

  let credentials;

  try {
    credentials = credentialsForNetwork({network});
  } catch (err) {
    return cbk([500, 'CredentialsLookupFailure', err]);
  }

  const daemon = spawn(serverDefaults[network].executable, [
    '--api-key', credentials.pass,
    '--http-port', credentials.port,
    '--index-tx',
    '--network', networkName,
    '--prefix', dir,
  ]);

  daemon.stdout.on('data', data => {
    if (rpcServerReady.test(`${data}`)) {
      return cbk(null, {daemon});
    }

    return;
  });

  return daemon;
};

