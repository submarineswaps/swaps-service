const {join} = require('path');
const {spawn} = require('child_process');

const credentialsForNetwork = require('./../../chain/credentials_for_network');
const {ECPair} = require('./../../tokenslib');
const {networks} = require('./../../tokenslib');
const {payments} = require('./../../tokenslib');

const defaultListenPort = 19495;
const {fromPublicKey} = ECPair;
const knownDaemons = ['btcd', 'ltcd'];
const notFoundIndex = -1;
const {p2pkh} = payments;
const rpcServerReady = /RPC.server.listening/;
const unableToStartServer = /Unable.to.start.server/;

/** Start a BTCSuite Type Daemon

  {
    daemon: <Daemon Name String>
    dir: <Data Directory String>
    [is_tls]: <Uses TLS Bool>
    [listen_port]: <Listen Port Number>
    mining_public_key: <Mining Public Key Hex String>
    network: <Network Name String>
    [rpc_port]: <Rpc Port Number>
  }

  @returns
  <Daemon Object>

  @returns via cbk
  {
    daemon: <Daemon Child Process Object>
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

  const pubkey = fromPublicKey(miningKey, network).publicKey;

  try {
    credentials = credentialsForNetwork({network: args.network});
  } catch (err) {
    return cbk([500, 'CredentialsLookupFailure', err]);
  }

  const daemon = spawn(args.daemon, [
    '--datadir', args.dir,
    '--listen', `127.0.0.1:${args.listen_port || defaultListenPort}`,
    '--logdir', args.dir,
    '--miningaddr', p2pkh({network, pubkey}).address,
    (!args.is_tls ? '--notls' : null),
    '--regtest',
    '--relaynonstd',
    '--rpccert', join(args.dir, 'rpc.cert'),
    '--rpckey', join(args.dir, 'rpc.key'),
    '--rpclisten', `${credentials.host}:${args.rpc_port || credentials.port}`,
    '--rpcpass', credentials.pass,
    '--rpcuser', credentials.user,
    '--txindex',
  ]);

  daemon.stdout.on('data', data => {
    if (unableToStartServer.test(`${data}`)) {
      return cbk([503, 'SpawnDaemonFailure', args]);
    }

    if (rpcServerReady.test(`${data}`)) {
      return cbk(null, {daemon});
    }

    return;
  });

  return daemon;
};

