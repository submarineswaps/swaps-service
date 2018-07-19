process.env.GRPC_SSL_CIPHER_SUITES = "HIGH+ECDSA";
const {test} = require('tap');
const {spawnLNDDaemon} = require('./../macros');

test(`spawn lnd + chaindaemon`, t => {

  return spawnLNDDaemon({
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


