const {test} = require('tap');

const {refundSuccess} = require('./../macros');

[false, true].forEach(isRefundToPublicKeyHash => {
  test(`p2sh refund test: is pkhash? ${isRefundToPublicKeyHash}`, t => {
    return refundSuccess({
      daemon: 'bcash',
      is_refund_to_public_key_hash: isRefundToPublicKeyHash,
      network: 'bcashregtest',
      swap_type: 'p2sh',
    },
    err => {
      if (!!err) {
        throw new Error(err);
      }

      return t.end();
    });
  });
});

