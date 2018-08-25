const varuint = require('varuint-bitcoin')

const types = require('./types');

const magicBytes = Buffer.from(types.global.magic);
const separator = Buffer.from(types.global.separator, 'hex');

/** Encode a Partially Signed Bitcoin Transaction

  {
    pairs: [{
      value: <Value Buffer Object>
      type: <Type Buffer Object>
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

  const components = [magicBytes, separator];

  components.push(Buffer.concat(pairs.map(({type, value}) => {
    const typeLength = varuint.encode(type.length);

    if (!type.length) {
      return typeLength;
    }

    return Buffer.concat([
      typeLength,
      type,
      varuint.encode(value.length),
      value,
    ]);
  })));

  return {psbt: Buffer.concat(components).toString('hex')};
};

