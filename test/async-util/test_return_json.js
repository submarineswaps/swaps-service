const {test} = require('tap');

const {returnJson} = require('./../../async-util');

// returnJson: Test sending normal JSON
test('normal json is sent when the result is returned to the cbk', t => {
  const log = msg => t.fail();
  const fixture = {foo: 'bar'};

  const json = ({foo}) => t.equal(foo, fixture.foo) && t.end();

  const res = {json};

  return returnJson({log, res})(null, fixture);
});

// returnJson: Test sending errors
test('error is sent when error is the result of the function', t => {
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

