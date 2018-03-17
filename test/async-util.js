const {log} = console;

const {test} = require('tap');

const {returnJson} = require('./../async-util');
const {returnResult} = require('./../async-util');

// returnJson: Test sending normal JSON
test('normal json is sent', t => {
  const log = msg => t.fail();
  const fixture = {foo: 'bar'};

  const json = ({foo}) => t.equal(foo, fixture.foo) && t.end();

  const res = {json};

  return returnJson({log, res})(null, fixture);
});

// returnJson: Test sending errors
test('error is sent', t => {
  const fixture = [500, 'ServerError'];

  const res = {};

  const status = code => {
    t.equal(code, fixture[0]);

    return res;
  };

  const log = msg => t.equal(msg, fixture);
  const send = msg => t.equal(msg, fixture[1]) && t.end();

  res.send = send;
  res.status = status;

  return returnJson({log, res})(fixture);
});

// returnResult: Test returning the result of an asyncAuto
test('result is returned in isolation', t => {
  const fixture = {baz: 1, foo: 'bar'};

  const cbk = (err, res) => {
    t.equal(err, null);
    t.equal(res, fixture.foo);
    t.equal(res.baz, undefined);

    t.end();
  };

  return returnResult({of: 'foo'}, cbk)(null, fixture);
});

// returnResult: Test returning errors
test('error is passed along', t => {
  const fixture = 'ServerError';

  const cbk = (err, res) => {
    t.equal(err, fixture);

    t.end();
  };

  return returnResult({}, cbk)(fixture);
});

