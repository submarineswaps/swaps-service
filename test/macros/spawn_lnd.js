const {join} = require('path');
const {readFileSync} = require('fs');
const {spawn} = require('child_process');

const asyncAuto = require('async/auto');
const {createSeed} = require('ln-service');
const {createWallet} = require('ln-service');
const {getWalletInfo} = require('ln-service');
const {lightningDaemon} = require('ln-service');
const uuidv4 = require('uuid/v4');

const {generateKeyPair} = require('./../../chain');
const spawnChainDaemon = require('./spawn_chain_daemon');
const {stopChainDaemon} = require('./../../chain');

const adminMacaroonFileName = 'admin.macaroon';
const chainDaemonIp = '127.0.0.1';
const chainDaemonListenPort = 32949;
const chainDaemonPassword = 'pass';
const chainDaemonRpcPort = 18885;
const chainDaemonType = 'btcd';
const chainDaemonUsername = 'x';
const chainRpcCertName = 'rpc.cert';
const invoiceMacaroonFileName = 'invoice.macaroon';
const lightningDaemonExecFileName = 'lnd';
const lightningDaemonIp = '127.0.0.1';
const lightningDaemonLogPath = 'logs/';
const lightningDaemonPort = 29351;
const lightningDaemonRestPort = 29350;
const lightningDaemonRpcPort = 29349;
const lightningSeedPassphrase = 'passphrase';
const lightningTlsCertFileName = 'tls.cert';
const lightningTlsKeyFileName = 'tls.key';
const lightningWalletPassword = 'password';
const lndConfFileName = 'lnd.conf';
const network = 'regtest';
const readMacaroonFileName = 'readonly.macaroon';
const startWalletTimeoutMs = 4500;

/** Spawn an lnd instance

  {}

  @returns via cbk
  {
    cert: <Base 64 TLS Certificate String>
    host: <IP and Port String>
    kill: <Stop Function> ({}, () => {})
    lnd: <LND GRPC API Object>
    macaroon: <Base 64 Admin Macaroon String>
  }
*/
module.exports = ({}, cbk) => {
  return asyncAuto({
    // Generate a mining key for the backing btcd
    generateKey: cbk => {
      try {
        return cbk(null, generateKeyPair({network}));
      } catch (err) {
        return cbk([500, 'FailedToGenerateKeyPair', err]);
      }
    },

    // Spawn a backing chain daemon for lnd
    spawnChainDaemon: ['generateKey', ({generateKey}, cbk) => {
      return spawnChainDaemon({
        network,
        daemon: chainDaemonType,
        is_tls: true,
        listen_port: chainDaemonListenPort,
        mining_public_key: generateKey.public_key,
        rpc_port: chainDaemonRpcPort,
      },
      cbk);
    }],

    // Spawn the lnd instance with the backing chain daemon
    spawnLnd: ['spawnChainDaemon', ({spawnChainDaemon}, cbk) => {
      const {dir} = spawnChainDaemon;

      const daemon = spawn(lightningDaemonExecFileName, [
        '--adminmacaroonpath', join(dir, adminMacaroonFileName),
        '--bitcoin.active',
        '--bitcoin.chaindir', dir,
        '--bitcoin.node', chainDaemonType,
        '--bitcoin.regtest',
        '--btcd.dir', dir,
        '--btcd.rpccert', join(dir, chainRpcCertName),
        '--btcd.rpchost', `${chainDaemonIp}:${chainDaemonRpcPort}`,
        '--btcd.rpcpass', chainDaemonPassword,
        '--btcd.rpcuser', chainDaemonUsername,
        '--configfile', join(dir, lndConfFileName),
        '--datadir', dir,
        '--invoicemacaroonpath', join(dir, invoiceMacaroonFileName),
        '--listen', `${lightningDaemonIp}:${lightningDaemonPort}`,
        '--logdir', join(dir, lightningDaemonLogPath),
        '--nobootstrap',
        '--readonlymacaroonpath', join(dir, readMacaroonFileName),
        '--restlisten', `${lightningDaemonIp}:${lightningDaemonRestPort}`,
        '--rpclisten', `${lightningDaemonIp}:${lightningDaemonRpcPort}`,
        '--tlscertpath', join(dir, lightningTlsCertFileName),
        '--tlskeypath', join(dir, lightningTlsKeyFileName),
      ]);

      daemon.stderr.on('data', data => {})

      let isReady = false;

      daemon.stdout.on('data', data => {
        if (!isReady && /password.RPC.server.listening/.test(data+'')) {
          isReady = true;

          return cbk(null, {daemon});
        };
      });

      return;
    }],

    // Get connection to the no-wallet lnd
    nonAuthenticatedLnd: [
      'spawnChainDaemon',
      'spawnLnd',
      ({spawnChainDaemon}, cbk) =>
    {
      const {dir} = spawnChainDaemon;

      const cert = readFileSync(join(dir, lightningTlsCertFileName));

      try {
        return cbk(null, lightningDaemon({
          cert: cert.toString('base64'),
          host: `${lightningDaemonIp}:${lightningDaemonRpcPort}`,
          service: 'WalletUnlocker',
        }));
      } catch (err) {
        return cbk([503, 'FailedToLaunchLightningDaemon', err]);
      }
    }],

    // Create seed
    createSeed: ['nonAuthenticatedLnd', ({nonAuthenticatedLnd}, cbk) => {
      return createSeed({
        lnd: nonAuthenticatedLnd,
        passphrase: lightningSeedPassphrase,
      },
      cbk);
    }],

    // Create wallet
    createWallet: [
      'createSeed',
      'nonAuthenticatedLnd',
      'spawnLnd',
      ({createSeed, nonAuthenticatedLnd, spawnLnd}, cbk) =>
    {
      return createWallet({
        lnd: nonAuthenticatedLnd,
        passphrase: lightningSeedPassphrase,
        password: lightningWalletPassword,
        seed: createSeed.seed,
      },
      err => {
        if (!!err) {
          return cbk(err);
        }

        return setTimeout(() => cbk(), startWalletTimeoutMs);
      });
    }],

    // Wallet details
    wallet: ['createWallet', ({spawnChainDaemon}, cbk) => {
      const {dir} = spawnChainDaemon;
      const certPath = join(dir, lightningTlsCertFileName);
      const macaroonPath = join(dir, adminMacaroonFileName);

      return cbk(null, {
        cert: readFileSync(certPath).toString('base64'),
        host: `${lightningDaemonIp}:${lightningDaemonRpcPort}`,
        macaroon: readFileSync(macaroonPath).toString('base64'),
      });
    }],

    // Wallet LND GRPC API
    lnd: ['wallet', ({wallet}, cbk) => {
      try {
        return cbk(null, lightningDaemon({
          cert: wallet.cert,
          host: wallet.host,
          macaroon: wallet.macaroon,
        }));
      } catch (err) {
        return cbk([503, 'FailedToInstantiateWalletLnd', err]);
      }
    }],

    // Check that the lnd is working
    checkLnd: ['lnd', ({lnd}, cbk) => getWalletInfo({lnd}, cbk)],

    // Kill method
    killCommand: [
      'spawnChainDaemon',
      'spawnLnd',
      ({spawnChainDaemon, spawnLnd}, cbk) =>
    {
      const kill = ({}, cbk) => {
        spawnLnd.daemon.on('close', () => {
          spawnChainDaemon.daemon.on('close', () => cbk());

          return spawnChainDaemon.daemon.kill();
        });

        spawnLnd.daemon.kill();
      };

      return cbk(null, {kill});
    }],
  },
  (err, res) => {
    if (!!err && !!res.killCommand) {
      return res.killCommand.kill({}, e => cbk(e || err));
    }

    if (!!err) {
      return cbk(err);
    }

    return cbk(null, {
      cert: res.wallet.cert,
      host: res.wallet.host,
      kill: res.killCommand.kill,
      lnd: res.lnd,
      macaroon: res.wallet.macaroon,
    });
  });
};

