const {spawn} = require('child_process');
const path = require('path');

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
    no_mine: <Disable mining boolean>
    peer: <Peer daemon address string>
    simnet: <Simnet enable boolean>
    tls: <Enable TLS boolean>
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

  if (!args.no_mine && !args.mining_public_key && !args.finished_mining_public_key) {
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
  if (args.port) {
    credentials.port = args.port;
  }

  let params = [
    '--datadir', args.dir,
    '--debuglevel=debug',
    '--logdir', args.dir,
    '--relaynonstd',
    '--rpclisten', `${credentials.host}:${credentials.port}`,
    '--rpcpass', credentials.pass,
    '--rpcuser', credentials.user,
    '--txindex',];
  if (!args.no_mine) {
    let miningKey;
    if (args.finished_mining_public_key) {
      miningKey = args.finished_mining_public_key
    } else {
      miningKey = fromPublicKeyBuffer(Buffer.from(args.mining_public_key, 'hex'), network).getAddress();
    }
    params = [...params, '--miningaddr', miningKey];
  }

  if (args.tls) {
    params = [...params,
      `--rpccert=${path.join(args.dir, 'rpc.cert')}`,
      `--rpckey=${path.join(args.dir, 'rpc.key')}`]
  } else {
    params = [...params, '--notls',]
  }

  if (args.peer) {
    params = [...params,
      '--addpeer', args.peer];
  }

  if (args.simnet) {
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

