const bitcoinjsLib = require('bitcoinjs-lib');
const removeDir = require('rimraf');
const {spawn} = require('child_process');
const uuidv4 = require('uuid/v4');

const {testnet} = bitcoinjsLib.networks;

const chainServer = require('./../conf/chain_server');

const rpcServerReady = /RPC.server.listening/;
const unableToStartServer = /Unable.to.start.server/;

/** Spawn a chain daemon

  {
    mining_public_key: <Mining Public Key String>
  }
*/
module.exports = (args, cbk) => {
  const miningKey = Buffer.from(args.mining_public_key, 'hex');
  const rpcHost = chainServer.rpc_host;
  const rpcPass = chainServer.rpc_pass;
  const rpcPort = chainServer.rpc_port;
  const rpcUser = chainServer.rpc_user;
  const tmpDir = `/tmp/${uuidv4()}`;

  const keyPair = bitcoinjsLib.ECPair.fromPublicKeyBuffer(miningKey, testnet);

  const daemon = spawn('btcd', [
    '--datadir', tmpDir,
    '--logdir', tmpDir,
    '--miningaddr', keyPair.getAddress(),
    '--notls',
    '--regtest',
    '--relaynonstd',
    '--rpclisten', `${rpcHost}:${rpcPort}`,
    '--rpcpass', rpcPass,
    '--rpcuser', rpcUser,
    '--txindex',
  ]);

  daemon.stderr.on('data', data => console.log(`${data}`));

  daemon.stdout.on('data', data => {
    if (unableToStartServer.test(`${data}`)) {
      return cbk([0, 'Failed to spawn daemon']);
    }

    if (rpcServerReady.test(`${data}`)) {
      return cbk();
    }

    return;
  });

  daemon.stderr.on('data', data => console.log(`DAEMON ERR ${data}`));

  daemon.on('close', code => removeDir(tmpDir, () => {}));

  return;
};

