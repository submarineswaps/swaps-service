const {test} = require('tap');

const {claimSuccess} = require('./../macros');

[false, true].forEach(isPkHash => {
  // Make sure that we can swap with a pkhash
  test(`perform swap: pkhash: ${isPkHash}, p2wsh swap address`, t => {
    return claimSuccess({
      daemon: 'ltcd',
      network: 'ltcregtest',
      is_refund_to_public_key_hash: isPkHash,
      swap_type: 'p2wsh',
    },
    testErr => {
      if (!!testErr) {
        console.log(testErr);
        throw new Error('FailedClaimSuccess');
      }

      t.end();

      return;
    });
  });

  return;
});

