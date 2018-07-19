const removeDir = require('rimraf');
const {spawn} = require('child_process');
const uuidv4 = require('uuid/v4');
const asyncAuto = require('async/auto');
const rpcServerReady = /password RPC server listening on|Finished rescan for 0 addresses/;
const namespaceFail = /Shutdown complete|Done generating TLS certificates/;

const exec = require('child_process').exec;
const path = require('path');
const fs = require('fs');
const {createAddress} = require('ln-service');

process.env.GRPC_SSL_CIPHER_SUITES = "HIGH+ECDSA";
const {lightningDaemon} = require('ln-service');
const {unlockWallet} = require('ln-service');
const {getPeers} = require('ln-service');
const {signMessage} = require('ln-service');
const returnResult = require('./../../async-util/return_result');

// const {createAddress} = require('ln-service');
const {generateKeyPair} = require('./../../chain');
const {stopChainDaemon} = require('./../../chain');
const {clearCache} = require('./../../cache');
const spawnChainDaemon = require('./../macros/spawn_chain_daemon');
const credentialsForNetwork = require('./../../chain/credentials_for_network');


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
      const baseChainDir = path.join('/tmp', uuidv4());
      const lndChainDir = path.join('/tmp', uuidv4());

      return cbk(null, {
        lndChainDir,
        baseChainDir,
        chainPass: credentials.pass,
        chainUser: credentials.user,
        baseChainPort: credentials.port,
        lndChainPort: credentials.port - 1,
      });
    },
    copyCerts: ['validateCredentials', ({validateCredentials}, cbk) => {
      fs.mkdirSync(validateCredentials.lndChainDir);
      fs.copyFile(path.resolve(__dirname, '../swap_regtest', 'dummyrpc.cert'), path.join(validateCredentials.lndChainDir, 'rpc.cert'), copyFail);
      fs.copyFile(path.resolve(__dirname, '../swap_regtest', 'dummyrpc.key'), path.join(validateCredentials.lndChainDir, 'rpc.key'), copyFail);
      return cbk(null, {});

    }],
    spawnTLSBTCD: ['copyCerts', 'validateCredentials', ({validateCredentials}, cbk) => {
      spawnChainDaemon({
        network: args.network,
        daemon: "btcd",
        dir: validateCredentials.lndChainDir,
        noTLS: false,
        tls: true,
        noMine: true,
        simnet: true,
        port: validateCredentials.lndChainPort
      }, (err, res) => {
        return cbk(err, res);
      });
    }],
    spawnLND: ['spawnTLSBTCD', 'validateCredentials', ({validateCredentials}, cbk) => {
      try {
        const lndDir = path.join('/tmp', uuidv4());
        fs.mkdirSync(lndDir);

        fs.copyFile(path.resolve(__dirname, '../swap_regtest', 'dummymacaroons.db'), path.join(lndDir, 'macaroons.db'), copyFail);
        fs.copyFile(path.resolve(__dirname, '../swap_regtest', 'dummyadmin.macaroon'), path.join(lndDir, 'admin.macaroon'), copyFail);
        fs.copyFile(path.resolve(__dirname, '../swap_regtest', 'dummyinvoice.macaroon'), path.join(lndDir, 'invoice.macaroon'), copyFail);
        fs.copyFile(path.resolve(__dirname, '../swap_regtest', 'dummyreadonly.macaroon'), path.join(lndDir, 'readonly.macaroon'), copyFail);
        fs.copyFile(path.resolve(__dirname, '../swap_regtest', 'lndtls.cert'), path.join(lndDir, 'tls.cert'), copyFail);
        fs.copyFile(path.resolve(__dirname, '../swap_regtest', 'lndtls.key'), path.join(lndDir, 'tls.key'), copyFail);
        let chainParams;
        switch (args.daemon) {
        case "btcd":
          chainParams = [
            `--btcd.dir=${validateCredentials.lndChainDir}`,
            `--btcd.rpcpass=${validateCredentials.chainPass}`,
            `--btcd.rpchost=127.0.0.1:${validateCredentials.lndChainPort}`,
            `--btcd.rpcuser=${validateCredentials.chainUser}`,
            `--bitcoin.active`,
            `--bitcoin.feerate=2500`,
            `--bitcoin.node=btcd`,
            `--bitcoin.simnet`,
            `--btcd.rpccert=${path.join(validateCredentials.lndChainDir, 'rpc.cert')}`,
          ];
          break;
        default:
          return cbk(['0', 'UnknownLightningBackendChain']);
        }
        let lndDaemon;
        lndDaemon = spawn('lnd', [
          `--configfile=""`,
          `--datadir="${lndDir}"`,
          // '--no-macaroons',
          `--adminmacaroonpath=${path.join(lndDir, 'admin.macaroon')}`,
          `--tlscertpath=${path.join(lndDir, 'tls.cert')}`,
          `--tlskeypath=${path.join(lndDir, 'tls.key')}`,
          `--logdir="${lndDir}/logs/"`,
          '--noencryptwallet',
          '--debuglevel=trace',
          '--rpclisten=127.0.0.1:10009',
          `--autopilot.active`,
          `--autopilot.maxchannels=10`,
          `--autopilot.minchansize=100000`,
          `--autopilot.allocation=0.8`,
          ...chainParams]);
        lndDaemon.stderr.on('err', data => { });
        lndDaemon.stdout.on('data', data => {
            if (namespaceFail.test(`${data}`)) {
              lndDaemon.kill();
              lndDaemon = spawn('lnd', [
                `--configfile=""`,
                `--datadir="${lndDir}"`,
                `--adminmacaroonpath=${path.join(lndDir, 'admin.macaroon')}`,
                `--tlscertpath=${path.join(lndDir, 'tls.cert')}`,
                `--tlskeypath=${path.join(lndDir, 'tls.key')}`,
                `--logdir="${lndDir}/logs/"`,
                '--noencryptwallet',
                '--debuglevel=trace',
                `--autopilot.active`,
                `--autopilot.maxchannels=10`,
                `--autopilot.minchansize=100000`,
                `--autopilot.allocation=0.8`,
                ...chainParams]);
              lndDaemon.stdout.on('data', data => {
                if (rpcServerReady.test(`${data}`)) {
                  setTimeout(function () {
                    return cbk(null, {is_ready: true, lndDir});
                  }, 2000);
                }

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
          // removeDir(lndDir, () => {});
          // removeDir(validateCredentials.lndChainDir, () => {});
        });

        process.on('uncaughtException', err => {          // daemon.kill();
          process.exit(1);
        });

      } catch (e) { }
    }],

    spawnLNDInterface: ['spawnLND', ({spawnLND}, cbk) => {
      if (!spawnLND.is_ready) {
        return cbk([0, "LNDaemon failed to ready"]);
      }
      const cert = new Buffer(fs.readFileSync(path.join(spawnLND.lndDir, 'tls.cert'))).toString('base64');
      const macaroon = new Buffer(fs.readFileSync(path.join(spawnLND.lndDir, 'admin.macaroon'))).toString('base64');
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

    //
    // stopBTCDBackend: ['genAddress', ({}, cbk) => {
    //   return stopChainDaemon({network: args.network}, stopErr => {return cbk(stopErr);});
    // }],
    //
    // rebootBTCDWithMiningAddress: ['stopBTCDBackend', 'genAddress', 'validateCredentials', ({genAddress, validateCredentials}, cbk) => {
    //    //    //    //   spawnChainDaemon({
    //     network: args.network,
    //     daemon: args.daemon,
    //     dir: validateCredentials.lndChainDir,
    //     mining_public_key: genAddress.address
    //   }, (err, res) => {
    //     return cbk(err, res);
    //   });
    //   // stopChainDaemon({network: args.network}, stopErr => {return cbk(stopErr);});
    //
    // }]


    // }, (err, res) => {
    //    //   if (!!res.spawnLND && !!res.spawnLND.is_ready) {
    //    //     // return stopChainDaemon({network: args.network}, stopErr => {
    //     //   return cbk(stopErr || err);
    //     // });
    //   }
    //
    //   if (!!err) {
    //    //    //     return cbk(err);
    //   }
    //
    //   return clearCache({cache: 'memory'}, cbk);
  }, returnResult({of: 'startNoTLSBTCD'}, cbk));
};