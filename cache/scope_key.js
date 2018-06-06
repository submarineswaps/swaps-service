const {createHash} = require('crypto');

/** Scope a key given a type and a key so that it avoids conflicts within a
  cache.

  {
    key: <Key String>
    type: <Type String>
  }

  @returns
  <Scoped Key String>
*/
module.exports = ({key, type}) => {
  return createHash('sha256').update([type, key].join('/')).digest('hex');
};

