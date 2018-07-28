const {test} = require('tap');

const {p2pkhOutputScript} = require('./../../script');

const tests = [{
  args: {hash: '0000000000000000000000000000000000000000'},
  expected: '76a914000000000000000000000000000000000000000088ac',
  purpose: 'When forming a p2pkh output script, expected script is formed',
}];

tests.forEach(({args, expected, purpose}) => {
  return test(purpose, t => {
    t.equal(p2pkhOutputScript(args).toString('hex'), expected);

    return t.end();
  });
});

