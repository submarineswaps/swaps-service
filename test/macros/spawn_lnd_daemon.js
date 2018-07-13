const removeDir = require('rimraf');
const {spawn} = require('child_process');
const uuidv4 = require('uuid/v4');
const asyncAuto = require('async/auto');
const rpcServerReady = /password RPC server listening on|Finished rescan for 0 addresses/;

const exec = require('child_process').exec;
const {join} = require('path');
const fs = require('fs');

process.env.GRPC_SSL_CIPHER_SUITES = "HIGH+ECDSA";
const {lightningDaemon} = require('ln-service');
const {getPeers} = require('ln-service');
const {signMessage} = require('ln-service');
const returnResult = require('./../../async-util/return_result');

const {createAddress} = require('ln-service');
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
      const chainDir = join('/tmp', uuidv4());
      return cbk(null, {
        chainDir,
        chainPass: credentials.pass,
        chainUser: credentials.user,
        chainPort: credentials.port
      });
    },
    copyCerts: ['validateCredentials', ({validateCredentials}, cbk) => {
      fs.copyFile('./swap_regtest/dummyrpc.cert', join(validateCredentials.chainDir, 'rpc.cert'), (err) => {console.log(err);});
      fs.copyFile('./swap_regtest/dummyrpc.key', join(validateCredentials.chainDir, 'rpc.key'), (err) => {console.log(err);});
      return cbk(null, {});
    }],
    spawnTLSBTCD: ['copyCerts', 'validateCredentials', ({validateCredentials}, cbk) => {
      console.log("spawning chain");
      spawnChainDaemon({
        network: 'btcdbackend', daemon: args.daemon, dir: validateCredentials.chainDir
      }, (err, res) => {
        return cbk(err, res);
      });
    }],
    spawnLND: ['spawnTLSBTCD', 'validateCredentials', ({validateCredentials}, cbk) => {
      try {
        console.log("lnd spawnLND entry");
        console.log("Recieved:");
        const lndDir = join('/tmp', uuidv4());
        console.log(lndDir);
        let chainParams;
        switch (args.daemon) {
        case "btcd":
          console.log("entering btcd");
          chainParams = [
            `--btcd.dir=${validateCredentials.chainDir}`,
            `--btcd.rpcpass=${validateCredentials.chainPass}`,
            `--btcd.rpchost=127.0.0.1:${validateCredentials.chainPort}`,
            `--btcd.rpcuser=${validateCredentials.chainUser}`,
            `--bitcoin.active`,
            `--bitcoin.feerate=2500`,
            `--bitcoin.node=btcd`,
            `--bitcoin.simnet`,
            // `--btcd.rpccert=${join(spawnTLSBTCD.chainDir, 'rpc.cert')}`
          ];
          break;
        case "bitcoind":
          chainParams = [
            `--bitcoin.active`,
            `--bitcoin.feerate=2500`,
            `--bitcoind.dir=${validateCredentials.chainDir}`,
            `--bitcoind.rpcpass=${validateCredentials.chainPass}`,
            `--bitcoind.rpchost=127.0.0.1:${validateCredentials.chainPort}`,
            `--bitcoind.rpcuser=${validateCredentials.chainUser}`,
            `--bitcoind.zmqpath=tcp://127.0.0.1:28332`,
            `--bitcoin.node=bitcoind`,
            `--bitcoin.regtest`
          ];
          break;
        default:
          return cbk(['0', 'UnknownLightningBackendChain']);
        }
        const lndDaemon = spawn('lnd', [
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
          ...chainParams]);

        console.log("lndDaemon spawned");
        lndDaemon.stderr.on('data', data => {
          console.log("==LND==" + data.toString());
        });
        lndDaemon.stdout.on('data', data => {
          console.log(data.toString());
          if (rpcServerReady.test(`${data}`)) {
            console.log("rdy!");
            setTimeout(function () {
              return cbk(null, {is_ready: true, lndDir});
            }, 2000);

          }
        });

        lndDaemon.on('close', code => {
          removeDir(lndDir, () => {});
          removeDir(validateCredentials.chainDir, () => {});
        });

        process.on('uncaughtException', err => {
          console.log('LND ERROR', err);
          // daemon.kill();
          process.exit(1);
        });

      } catch (e) {
        console.log(e);
      }
    }],

    spawnRPCInterface: ['spawnLND', ({spawnLND}, cbk) => {
      if (!spawnLND.is_ready) {
        return cbk([0, "LNDaemon failed to ready"]);
      }
      const cert = new Buffer(fs.readFileSync(join(spawnLND.lndDir, 'tls.cert'))).toString('base64');
      const macaroon = new Buffer(fs.readFileSync(join(spawnLND.lndDir, 'admin.macaroon'))).toString('base64');

      console.log(cert);
      console.log(macaroon);

      const host = '127.0.0.1:10009';
      const lnd = lightningDaemon({cert, host, macaroon});

      console.log("spawned");

      return cbk(null, {lnd});

    }],

    verifyRPCInterface: ['spawnRPCInterface', ({spawnRPCInterface}, cbk) => {
      console.log("outstart");

      signMessage({lnd: spawnRPCInterface.lnd, message: " "}, (err, res) => {
        if (!res.signature) {
          return cbk([0, 'ExpectedValidLNDSignedMessage']);
        } else {
          return cbk(null, {lnd: spawnRPCInterface});
        }
      });
    }]

    // genAddress: ['spawnRPCInterface', ({spawnRPCInterface}, cbk) => {
    //   console.log("==\n" * 4);
    //   console.log("Entering genAddress");
    //   return createAddress({lnd: spawnRPCInterface.lnd}, cbk);
    // }],
    //
    // stopBTCDBackend: ['genAddress', ({}, cbk) => {
    //   return stopChainDaemon({network: args.network}, stopErr => {return cbk(stopErr);});
    // }],
    //
    // rebootBTCDWithMiningAddress: ['stopBTCDBackend', 'genAddress', 'validateCredentials', ({genAddress, validateCredentials}, cbk) => {
    //   console.log("==\n" * 4);
    //   console.log("Entering rebootBTCDWithMiningAddress");
    //   console.log(genAddress);
    //   spawnChainDaemon({
    //     network: args.network,
    //     daemon: args.daemon,
    //     dir: validateCredentials.chainDir,
    //     mining_public_key: genAddress.address
    //   }, (err, res) => {
    //     return cbk(err, res);
    //   });
    //   // stopChainDaemon({network: args.network}, stopErr => {return cbk(stopErr);});
    //
    // }]


    // }, (err, res) => {
    //   console.log("wrapping up spawn_lnd_daemon");
    //   if (!!res.spawnLND && !!res.spawnLND.is_ready) {
    //     console.log(args.network);
    //     // return stopChainDaemon({network: args.network}, stopErr => {
    //     //   return cbk(stopErr || err);
    //     // });
    //   }
    //
    //   if (!!err) {
    //     console.log("spawn lnd error errored at end");
    //     console.log(err);
    //     return cbk(err);
    //   }
    //
    //   return clearCache({cache: 'memory'}, cbk);
  }, returnResult({of: 'verifyRPCInterface'}, cbk));
};