const getFromMemoryCache = require('./get_from_memory_cache');

/** Get a set from the memory cache

  {
    key: <Set Key String>
  }

  @returns via cbk
  {
    items: [<Set Item String>]
  }
*/
module.exports = ({key}, cbk) => {
  if (!key) {
    return cbk([400, 'ExpectedSetKeyToGet']);
  }

  return getFromMemoryCache({key}, (err, res) => {
    if (!!err) {
      return cbk(err);
    }

    const found = res || {};

    const items = Object.keys(found).map(key => found[key]);

    return cbk(null, {items});
  });
};

