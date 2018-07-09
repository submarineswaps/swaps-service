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

 @returns via cbk
 {
   is_ready: <Chain Daemon is Ready Bool>
 }
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
    '-conf=""',
    `-datadir=${dir}`,
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

