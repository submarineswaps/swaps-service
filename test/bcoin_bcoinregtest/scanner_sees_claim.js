const {test} = require('tap');

const {scanForSwap} = require('./../macros');

test('the block scanner picks up a claimed swap', t => {
  return scanForSwap({
    cache: 'memory',
    daemon: 'bcoin',
    network: 'bcoinregtest',
    type: 'claim',
  },
  err => {
    if (!!err) {
      console.log(err);
      throw new Error('ScannerFailedToIdentifySwaps');
    }

    t.end();

    return;
  });
});

