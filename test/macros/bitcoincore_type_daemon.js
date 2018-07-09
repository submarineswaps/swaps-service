const {spawn} = require('child_process');

const credentialsForNetwork = require('./../../chain/credentials_for_network');
const rpcServerReady = /init message: Done loading/;

/** Start a bitcoin core style daemon

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

  const daemon = spawn('bitcoind', [
    '-conf=""',
    `-datadir=${tmpDir}`,
    '-debuglogfile=debug.log',
    '-regtest=1',
    `-rpcport=${credentials.port}`,
    `-rpcpassword=${credentials.pass}`,
    `-rpcuser=${credentials.user}`,
    '-txindex=1',
    '-printtoconsole=1',
    '-minrelaytxfee=0',
    '-blockmintxfee=0',

  ]);

  daemon.stdout.on('data', data => {
    if (rpcServerReady.test(`${data}`)) {
      return cbk(null, {is_ready: true});
    }

    return;
  });

  return daemon;
};

