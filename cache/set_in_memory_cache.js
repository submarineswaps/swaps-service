const memoryCache = require('./memory_cache');

const msPerSec = 1e3;

/** Set a value in the memory cache

  {
    key: <Scoped Key String>
    ms: <Milliseconds to Cache Number>
    value: <Value Object>
  }
*/
module.exports = ({key, ms, type, value}, cbk) => {
  if (!key) {
    return cbk([400, 'ExpectedKey']);
  }

  if (!ms) {
    return cbk([400, 'ExpectedMs']);
  }

  if (!value) {
    return cbk([400, 'ExpectedValue']);
  }

  const cache = memoryCache({});

  const isSuccess = cache.set(key, value, ms / msPerSec);

  if (!isSuccess) {
    return cbk([500, 'ExpectedSetMemoryCacheSuccess']);
  }

  return cbk();
};
