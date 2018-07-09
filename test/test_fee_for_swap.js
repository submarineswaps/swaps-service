const {equal} = require('tap');

const {feeForSwap} = require('./../swaps');

const tests = {
  // When there is a very small send, the fee increases to compensate for dust
  small_sends_avoids_dust_limit: {
    args: {
      base_rate: 1000,
      fee_tokens_per_vbyte: 10,
      rate_destination: 1,
      rate_source: 1,
      send_tokens: 1000,
      swap_rate: 2500,
    },
    expected: {fee: 8000, tokens: 9000},
  },

  // Predictable fee rate is charged against a normal swap
  standard_fee_rates_are_reflected: {
    args: {
      base_rate: 100,
      fee_tokens_per_vbyte: 1,
      rate_destination: 1,
      rate_source: 0.01,
      send_tokens: 100000,
      swap_rate: 1000,
    },
    expected: {fee: 10300, tokens: 10010300},
  },
};

Object.keys(tests).map(k => tests[k]).forEach(({expected, args}) => {
  equal(feeForSwap(args).fee, expected.fee);
  equal(feeForSwap(args).tokens, expected.tokens);

  return;
});

