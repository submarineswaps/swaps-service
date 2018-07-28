const {test} = require('tap');

const {addJsonToCachedSet} = require('./../../cache');

// addJsonToCachedSet Test setting a value in a set
test('Adding a value to the cached set records the value', t => {
  return addJsonToCachedSet({
    cache: 'memory',
    key: 'key',
    ms: 3,
    sort: 'sort',
    type: 'type',
    value: {foo: 'bar'},
  },
  err => {
    if (!!err) {
      throw new Error('FailedToAddJsonToCachedSet');
    }

    t.end();
  });
});

