const NodeCache = require('node-cache');

let memoryCache;

/** Get the memory cache

  The memory cache is only suitable for testing in a regtest environment.

  {}

  @returns
  <Memory Cache Object>
*/
module.exports = ({}) => {
  if (!!memoryCache) {
    return memoryCache;
  }

  const cache = new NodeCache({});

  // Eliminate cache on flush
  cache.on('flush', () => {
    memoryCache.close();

    memoryCache = null;
  });

  memoryCache = cache;

  return cache;
};
