const {concat} = Buffer;

const BN = require('bn.js');

const bip32KeyLimit = Math.pow(2, 31);
const bip32PathSeparator = '/';
const byteLength = 4;
const decBase = 10;
const endianness = 'le';
const hardenedMarker = "'";

/** Encode a BIP32 path

  {
    path: <BIP 32 Path String>
  }

  @returns
  <BIP 32 Path Buffer Object>
*/
module.exports = ({path}) => {
  const [, child, childHardened, childIndex] = path.split(bip32PathSeparator);

  return concat([child, childHardened, childIndex].map(n => {
    const len = hardenedMarker.length;

    const path = n.slice(-len) === hardenedMarker ? n.slice(0, -len) : n;

    const value = parseInt(path, decBase) + bip32KeyLimit;

    return new BN(value, decBase).toArrayLike(Buffer, endianness, byteLength);
  }));
};

