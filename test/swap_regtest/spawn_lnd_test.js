process.env.GRPC_SSL_CIPHER_SUITES = "HIGH+ECDSA";
const {test} = require('tap');
const {spawnLndDaemon} = require('./../macros');

test(`spawn lnd + chaindaemon`, t => {

  return spawnLndDaemon({
      daemon: 'btcd',
      network: 'simnet',
    },
    testErr => {
      if (!!testErr) {
        throw new Error('FailedSpawnLNDaemon');
      }
      t.end();
      return;
    });
});


