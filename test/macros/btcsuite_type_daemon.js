const {spawn} = require('child_process');

const chainServer = require('./../../chain/conf/chain_server_defaults');
const credentialsForNetwork = require('./../../chain/credentials_for_network');
const {ECPair} = require('./../../tokenslib');
const {networks} = require('./../../tokenslib');

const {fromPublicKeyBuffer} = ECPair;
const knownDaemons = ['btcd', 'ltcd'];
const notFoundIndex = -1;
const rpcServerReady = /RPC.server.listening/;
const unableToStartServer = /Unable.to.start.server/;

/** Start a BTCSuite Type Daemon

  {
    daemon: <Daemon Name String>
    dir: <Data Directory String>
    mining_public_key: <Mining Public Key Hex String>
    network: <Network Name String>
  }

  @returns
  <Daemon Object>

  @returns via cbk
  {
    is_ready: <Chain Daemon is Ready Bool>
  }
*/
module.exports = (args, cbk) => {
  if (knownDaemons.indexOf(args.daemon) === notFoundIndex) {
    return cbk([400, 'ExpectedBtcsuiteDaemonName', args.daemon]);
  }

  if (!args.dir) {
    return cbk([400, 'ExpectedDirectoryForDaemon']);
  }

  if (!args.mining_public_key) {
    return cbk([400, 'ExpectedMiningPublicKeyForDaemon']);
  }

  if (!args.network) {
    return cbk([400, 'ExpectedNetworkNameForDaemon']);
  }


  let credentials;
  const miningKey = Buffer.from(args.mining_public_key, 'hex');
  const network = networks[args.network];

  try {
    credentials = credentialsForNetwork({network: args.network});
  } catch (e) {
    return cbk([500, 'CredentialsLookupFailure', e]);
  }
  let params = [
    '--datadir', args.dir,
    '--logdir', args.dir,
    // '--miningaddr', fromPublicKeyBuffer(miningKey, network).getAddress(),
    '--simnet',
    '--relaynonstd',
    '--rpclisten', `${credentials.host}:${credentials.port}`,
    '--rpcpass', credentials.pass,
    '--rpcuser', credentials.user,
    '--txindex',
    // '--rpccert', args.dir + "/rpc.cert",
    // '--notls',
    '--debuglevel=RPCS=trace'];
  //
  // if (!args.lnd){
  //   params = [...params, '--notls',]
  // }

  const daemon = spawn(args.daemon, params);
  console.log(params);
  daemon.stdout.on('data', data => {
    console.log("==BTCD==" + data.toString());
    if (unableToStartServer.test(`${data}`)) {
      return cbk([errCode.local_err, 'SpawnDaemonFailure']);
    }

    if (rpcServerReady.test(`${data}`)) {
      return cbk(null, {is_ready: true});
    }

    return;
  });

  return daemon;
};

