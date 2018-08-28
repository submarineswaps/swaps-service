const varuint = require('varuint-bitcoin')

const types = require('./types');

const globalSeparator = Buffer.from(types.global.separator, 'hex');
const magicBytes = Buffer.from(types.global.magic);
const terminator = Buffer.from('00', 'hex');

/** Encode a Partially Signed Bitcoin Transaction

  {
    pairs: [{
      [value]: <Value Buffer Object>
      [type]: <Type Buffer Object>
    }]
  }

  @throws
  <Failed To Encode Error>

  @returns
  {
    psbt: <Hex Encoded Partially Signed Bitcoin Transaction String>
  }
*/
module.exports = ({pairs}) => {
  if (!Array.isArray(pairs)) {
    throw new Error('ExpectedKeyValuePairsToEncode');
  }

  const components = [magicBytes, globalSeparator];

  let lastType = null;

  const encodedPairs = Buffer.concat(pairs.map(({type, value}) => {
    if (!type) {
      return terminator;
    }

    return Buffer.concat([
      varuint.encode(type.length),
      type,
      varuint.encode(value.length),
      value,
    ]);
  }));

  const psbt = Buffer.concat([
    magicBytes,
    globalSeparator,
    encodedPairs,
  ]);

  return {psbt: psbt.toString('hex')};
};

