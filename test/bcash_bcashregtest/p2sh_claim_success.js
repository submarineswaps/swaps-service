const {test} = require('tap');

const {claimSuccess} = require('./../macros');

[false, true].forEach(isPkHash => {
  // Make sure that we can swap with a pkhash
  test(`perform swap: pkhash: ${isPkHash}, p2sh swap address`, t => {
    return claimSuccess({
      daemon: 'bcash',
      is_refund_to_public_key_hash: isPkHash,
      network: 'bcashregtest',
      swap_type: 'p2sh',
    },
    testErr => {
      if (!!testErr) {
        throw new Error(testErr);
      }

      return t.end();
    });
  });

  return;
});

