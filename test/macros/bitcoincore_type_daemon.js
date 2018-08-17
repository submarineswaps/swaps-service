const {spawn} = require('child_process');
let fs = require('fs');

const credentialsForNetwork = require('./../../chain/credentials_for_network');
const rpcServerReady = /init message: Done loading/;

/** Start a bitcoin core style daemon

  {
    dir: <Path to Data Directory>
    network: <Network Name String>
  }

  @returns
  <Daemon Object>
*/
module.exports = ({dir, network}, cbk) => {
  if (!dir) {
    return cbk([400, 'ExpectedDirectoryForDaemon']);
  }

  if (!fs.existsSync(dir)){
    fs.mkdirSync(dir);
  }

  if (!network) {
    return cbk([400, 'ExpectedNetworkNameForDaemon']);
  }

  let credentials;

  try {
    credentials = credentialsForNetwork({network: network});
  } catch (e) {
    return cbk([500, 'CredentialsLookupFailure', e]);
  }

  const daemon = spawn('bitcoind', [
    '-blockmintxfee=0',
    '-conf=""',
    '-debuglogfile=debug.log',
    '-minrelaytxfee=0',
    '-printtoconsole=1',
    '-regtest=1',
    '-txindex=1',
    `-datadir=${dir}`,
    `-rpcpassword=${credentials.pass}`,
    `-rpcport=${credentials.port}`,
    `-rpcuser=${credentials.user}`,
  ]);

  daemon.stdout.on('data', data => {
    if (rpcServerReady.test(`${data}`)) {
      return cbk();
    }

    return;
  });

  return daemon;
};

