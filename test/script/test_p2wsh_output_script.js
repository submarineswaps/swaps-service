const {test} = require('tap');

const {p2wshOutputScript} = require('./../../script');

const tests = [{
  args: {script: '00'},
  expected: '00206e340b9cffb37a989ca544e6bb780a2c78901d3fb33738768511a30617afa01d',
  purpose: 'When forming a p2wsh output script, expected script is formed',
}];

tests.forEach(({args, expected, purpose}) => {
  return test(purpose, t => {
    t.equal(p2wshOutputScript(args).toString('hex'), expected);

    return t.end();
  });
});

