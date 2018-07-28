const {test} = require('tap');

const {p2wpkhOutputScript} = require('./../../script');

const tests = [{
  args: {hash: '0000000000000000000000000000000000000000'},
  expected: '00140000000000000000000000000000000000000000',
  purpose: 'When forming a p2wpkh output script, expected script is formed',
}];

tests.forEach(({args, expected, purpose}) => {
  return test(purpose, t => {
    t.equal(p2wpkhOutputScript(args).toString('hex'), expected);

    return t.end();
  });
});

