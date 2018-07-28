const {test} = require('tap');

const {parseTokenValue} = require('./../../chain');

const tests = [
  {
    args: {value: '20999999.9769'},
    expected: 2099999997690000,
    purpose: 'When parsing the max tokens value, max tokens are returned',
  },
  {
    args: {value: '2814749.76710656'},
    expected: 281474976710656,
    purpose: 'When parsing tam-bitcoin value, appropriate tokens are returned',
  },
  {
    args: {value: '1000000'},
    expected: 100000000000000,
    purpose: 'When parsing a mega-bitcoin, appropriate tokens are returned',
  },
  {
    args: {value: '0.00065536'},
    expected: 65536,
    purpose: 'When parsing the tonal base unit, appropriate tokens returned',
  },
  {
    args: {value: '0.00000001'},
    expected: 1,
    purpose: 'When parsing the minimal token value, minimal result returned',
  },
];

tests.forEach(({args, expected, purpose}) => {
  return test(purpose, t => {
    t.equal(parseTokenValue(args).tokens, expected);

    return t.end();
  });
});

