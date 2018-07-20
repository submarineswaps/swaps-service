const {spawn} = require('child_process');
const {join} = require('path');
const {resolve} = require('path');
const {createAddress} = require('ln-service');
const {lightningDaemon} = require('ln-service');
const {signMessage} = require('ln-service');
const removeDir = require('rimraf');
const uuidv4 = require('uuid/v4');
const fs = require('fs');

const asyncAuto = require('async/auto');
const returnResult = require('./../../async-util/return_result');
const spawnChainDaemon = require('./../macros/spawn_chain_daemon');
const credentialsForNetwork = require('./../../chain/credentials_for_network');

const rpcServerReady = /password RPC server listening on|Finished rescan for 0 addresses/;
const namespaceFail = /Shutdown complete|Done generating TLS certificates/;

/** Spawn an LND daemon for testing on regtest

 This method will also listen for uncaught exceptions and stop the daemon
 before the process dies.

 {
   network: <Network Name String>
   daemon: <Daemon Name String>
 }

 @returns via cbk
 {
   is_ready: <LND Daemon is Ready Bool>
 }
 */



module.exports = (args, cbk) => {

  const copyFail = function (err) {
    if (err) {return cbk(['0', 'FailedToCopyCredentials', err]);}
  };

  return asyncAuto({
    validateCredentials: cbk => {
      if (!args.network) {
        return cbk([400, 'ExpectedNetworkTypeForLNDaemon']);
      }
      if (!args.daemon) {
        return cbk([400, 'ExpectedDaemonTypeForLNDaemon']);
      }
      let credentials;
      try {
        credentials = credentialsForNetwork({network: args.network});
      } catch (e) {
        return cbk([500, 'CredentialsLookupFailure', e]);
      }
      const baseChainDir = join('/tmp', uuidv4());
      const lndChainDir = join('/tmp', uuidv4());

      return cbk(null, {
        lndChainDir,
        baseChainDir,
        chainPass: credentials.pass,
        chainUser: credentials.user,
        baseChainPort: credentials.port,
        lndChainPort: credentials.port - 1, // Uses 1 port under notls chain daemon for lightning backend chain
      });
    },

    copyCerts: ['validateCredentials', ({validateCredentials}, cbk) => {
      fs.mkdirSync(validateCredentials.lndChainDir);
      fs.copyFile(resolve(__dirname, '../swap_regtest', 'dummyrpc.cert'),
        join(validateCredentials.lndChainDir, 'rpc.cert'), copyFail);
      fs.copyFile(resolve(__dirname, '../swap_regtest', 'dummyrpc.key'),
        join(validateCredentials.lndChainDir, 'rpc.key'), copyFail);
      return cbk(null, {});

    }],

    spawnTLSBTCD: ['copyCerts', 'validateCredentials', ({validateCredentials}, cbk) => {
      spawnChainDaemon({
        network: args.network,
        daemon: "btcd",
        dir: validateCredentials.lndChainDir,
        noTLS: false,
        tls: true,
        no_mine: true,
        simnet: true,
        port: validateCredentials.lndChainPort
      }, (err, res) => {
        return cbk(err, res);
      });
    }],
    spawnLND: ['spawnTLSBTCD', 'validateCredentials', ({validateCredentials}, cbk) => {
      const lndDir = join('/tmp', uuidv4());
      fs.mkdirSync(lndDir);
      fs.copyFile(resolve(__dirname, '../swap_regtest', 'dummymacaroons.db'),
        join(lndDir, 'macaroons.db'), copyFail);
      fs.copyFile(resolve(__dirname, '../swap_regtest', 'dummyadmin.macaroon'),
        join(lndDir, 'admin.macaroon'), copyFail);
      fs.copyFile(resolve(__dirname, '../swap_regtest', 'dummyinvoice.macaroon'),
        join(lndDir, 'invoice.macaroon'), copyFail);
      fs.copyFile(resolve(__dirname, '../swap_regtest', 'dummyreadonly.macaroon'),
        join(lndDir, 'readonly.macaroon'), copyFail);
      fs.copyFile(resolve(__dirname, '../swap_regtest', 'lndtls.cert'),
        join(lndDir, 'tls.cert'), copyFail);
      fs.copyFile(resolve(__dirname, '../swap_regtest', 'lndtls.key'),
        join(lndDir, 'tls.key'), copyFail);

      let lndParams = [
        `--configfile=""`,
        `--datadir="${lndDir}"`,
        `--adminmacaroonpath=${join(lndDir, 'admin.macaroon')}`,
        `--tlscertpath=${join(lndDir, 'tls.cert')}`,
        `--tlskeypath=${join(lndDir, 'tls.key')}`,
        `--logdir="${lndDir}/logs/"`,
        '--noencryptwallet',
        '--debuglevel=trace',
        '--rpclisten=127.0.0.1:10009',
        `--autopilot.active`,
        `--autopilot.maxchannels=10`,
        `--autopilot.minchansize=100000`,
        `--autopilot.allocation=0.8`,
      ];
      switch (args.daemon) {
      case "btcd":
        lndParams = [...lndParams,
          `--btcd.dir=${validateCredentials.lndChainDir}`,
          `--btcd.rpcpass=${validateCredentials.chainPass}`,
          `--btcd.rpchost=127.0.0.1:${validateCredentials.lndChainPort}`,
          `--btcd.rpcuser=${validateCredentials.chainUser}`,
          `--bitcoin.active`,
          `--bitcoin.feerate=2500`,
          `--bitcoin.node=btcd`,
          `--bitcoin.simnet`,
          `--btcd.rpccert=${join(validateCredentials.lndChainDir, 'rpc.cert')}`,
        ];
        break;
      default:
        return cbk(['0', 'UnknownLightningBackendChain']);
      }
      let lndDaemon;
      lndDaemon = spawn('lnd', lndParams);
      lndDaemon.stderr.on('err', data => { });
      let manualKill = false;
      lndDaemon.stdout.on('data', data => {
          if (namespaceFail.test(`${data}`)) {
            lndDaemon.kill();
            manualKill = true;

            lndDaemon = spawn('lnd', lndParams);

            lndDaemon.stdout.on('data', data => {
              if (rpcServerReady.test(`${data}`)) {
                setTimeout(function () {
                  return cbk(null, {is_ready: true, lndDir});
                }, 2000);
              }
            });

            lndDaemon.on('close', code => {
              removeDir(lndDir, () => {});
              removeDir(validateCredentials.lndChainDir, () => {});
            });

            if (rpcServerReady.test(`${data}`)) {
              setTimeout(function () {
                return cbk(null, {is_ready: true, lndDir});
              }, 2000);
            }
          }
        }
      );

      lndDaemon.on('close', code => {
        if (!manualKill) {
          removeDir(lndDir, () => {});
          removeDir(validateCredentials.lndChainDir, () => {});
        }
      });

      process.on('uncaughtException', err => {          // daemon.kill();
        process.exit(1);
      });

    }],

    spawnLNDInterface: ['spawnLND', ({spawnLND}, cbk) => {
      if (!spawnLND.is_ready) {
        return cbk([0, "LNDaemon failed to ready"]);
      }
      const cert = new Buffer(fs.readFileSync(join(spawnLND.lndDir, 'tls.cert'))).toString('base64');
      const macaroon = new Buffer(fs.readFileSync(join(spawnLND.lndDir, 'admin.macaroon'))).toString('base64');
      const host = '127.0.0.1:10009';
      const lnd = lightningDaemon({cert, host, macaroon});
      return cbk(null, {lnd});

    }],

    verifyLNDInterface: ['spawnLNDInterface', ({spawnLNDInterface}, cbk) => {
      signMessage({lnd: spawnLNDInterface.lnd, message: " "}, (err, res) => {
        if (!res.signature) {
          return cbk([0, 'ExpectedValidLNDSignedMessage']);
        } else {
          setTimeout(() => {
            return cbk(null, {lnd: spawnLNDInterface.lnd});
          }, 5000);
        }
      });
    }],

    genAddress: ['verifyLNDInterface', ({verifyLNDInterface}, cbk) => {
      return createAddress({lnd: verifyLNDInterface.lnd}, cbk);
    }],

    startNoTLSBTCD: ['genAddress', 'validateCredentials', ({genAddress, validateCredentials}, cbk) => {
      spawnChainDaemon({
        network: args.network,
        daemon: "btcd",
        dir: validateCredentials.baseChainDir,
        finished_mining_public_key: genAddress.address,
        simnet: true,
        tls: false,
      }, (err, res) => {
        if (err) {
          return cbk(err);
        } else {
          return cbk(null, {lnd: genAddress.lnd});
        }
      });
    }],

  }, returnResult({of: 'startNoTLSBTCD'}, cbk));
};