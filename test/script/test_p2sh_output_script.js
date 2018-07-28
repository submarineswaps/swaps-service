const {test} = require('tap');

const {p2shOutputScript} = require('./../../script');

const tests = [{
  args: {script: '00'},
  expected: 'a9149f7fd096d37ed2c0e3f7f0cfc924beef4ffceb6887',
  purpose: 'When forming a p2sh output script, expected script is formed',
}];

tests.forEach(({args, expected, purpose}) => {
  return test(purpose, t => {
    t.equal(p2shOutputScript(args).toString('hex'), expected);

    return t.end();
  });
});

