process.env.GRPC_SSL_CIPHER_SUITES = "HIGH+ECDSA";
console.log("entering");
const {test} = require('tap');
const {spawnLNDDaemon} = require('./../macros');

test(`spawn lnd + chaindaemon`, t => {

  return spawnLNDDaemon({
      daemon: 'btcd',
      network: 'simnet',
    },
    testErr => {
      console.log(testErr);
      if (!!testErr) {
        console.log("\n\nerrstart");
        console.log(testErr);
        console.log("errend\n\n");
        throw new Error('FailedSpawnLNDaemon');
      }
      t.end();
      return;
    });
});


