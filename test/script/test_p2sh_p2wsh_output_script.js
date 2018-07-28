const {test} = require('tap');

const {p2shP2wshOutputScript} = require('./../../script');

const tests = [{
  args: {script: '00'},
  expected: 'a91466a823e1ae9236a70fe7321f5b26b09ec422a37787',
  purpose: 'When forming a p2sh p2wsh output script, expected script formed',
}];

tests.forEach(({args, expected, purpose}) => {
  return test(purpose, t => {
    t.equal(p2shP2wshOutputScript(args).toString('hex'), expected);

    return t.end();
  });
});

