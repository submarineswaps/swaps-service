const {ECPair, networks} = require('bitcoinjs-lib');
const removeDir = require('rimraf');
const {spawn} = require('child_process');
const uuidv4 = require('uuid/v4');

const chainServer = require('./../conf/chain_server');
const errCode = require('./../conf/error_codes');

const rpcServerReady = /RPC.server.listening/;
const unableToStartServer = /Unable.to.start.server/;

/** Spawn a chain daemon on regtest

  {
    mining_public_key: <Mining Public Key String>
  }
*/
module.exports = (args, cbk) => {
  const miningKey = Buffer.from(args.mining_public_key, 'hex');
  const rpcHost = chainServer.regtest.rpc_host;
  const rpcPass = chainServer.regtest.rpc_pass;
  const rpcPort = chainServer.regtest.rpc_port;
  const rpcUser = chainServer.regtest.rpc_user;
  const tmpDir = `/tmp/${uuidv4()}`;

  const keyPair = ECPair.fromPublicKeyBuffer(miningKey, networks.testnet);

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
      return cbk([errCode.local_err, 'Failed to spawn daemon']);
    }

    if (rpcServerReady.test(`${data}`)) {
      return cbk();
    }

    return;
  });

  daemon.on('close', code => removeDir(tmpDir, () => {}));

  process.on('uncaughtException', err => {
    console.log(err);
    daemon.kill();

    process.exit(1)
  });

  return;
};

