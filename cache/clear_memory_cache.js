const memoryCache = require('./memory_cache');

/** Clear the in-memory cache

  {}
*/
module.exports = ({}, cbk) => {
  const cache = memoryCache({});

  cache.flushAll();

  return cbk();
};

