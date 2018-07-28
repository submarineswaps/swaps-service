const {test} = require('tap');

const {returnResult} = require('./../../async-util');

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

