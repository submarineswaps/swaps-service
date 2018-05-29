/** Scope a key given a type and a key so that it avoids conflicts within a
  cache.

  {
    key: <Key String>
    type: <Type String>
  }

  @returns
  <Scoped Key String>
*/
module.exports = ({key, type}) => [type, key].join('/');

