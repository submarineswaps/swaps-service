const {spawn} = require('child_process');
const path = require('path');

const chainServer = require('./../../chain/conf/chain_server_defaults');
const credentialsForNetwork = require('./../../chain/credentials_for_network');
const {ECPair} = require('./../../tokenslib');
const {networks} = require('./../../tokenslib');

const {fromPublicKeyBuffer} = ECPair;
const knownDaemons = ['btcd', 'ltcd', 'btcdbackend'];
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

  if (!args.noMine && !args.mining_public_key) {
    return cbk([400, 'ExpectedMiningPublicKeyForDaemon']);
  }

  if (!args.network) {
    return cbk([400, 'ExpectedNetworkNameForDaemon']);
  }


  let credentials;

  const network = networks[args.network];
  try {
    credentials = credentialsForNetwork({network: args.network});
  } catch (e) {
    return cbk([500, 'CredentialsLookupFailure', e]);
  }
  let params = [
    '--datadir', args.dir,
    '--logdir', args.dir,
    '--relaynonstd',
    '--rpcpass', credentials.pass,
    '--rpcuser', credentials.user,
    '--debuglevel=trace'];
  if (!args.noMine) {
    const miningKey = Buffer.from(args.mining_public_key, 'hex');
    params = [...params, '--miningaddr', fromPublicKeyBuffer(miningKey, network).getAddress()];
  }
  if (args.tls) {
    params = [...params,
      `--rpccert=${path.join(args.dir, 'rpc.cert')}`,
      `--rpckey=${path.join(args.dir, 'rpc.key')}`]
  } else {
    params = [...params, '--notls',]
  }
  if (args.simnet){
    params = [...params, '--simnet']
  } else {
    params = [...params, '--regtest']
  }
  const daemon = spawn(args.daemon, params);
  daemon.stdout.on('data', data => {
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

