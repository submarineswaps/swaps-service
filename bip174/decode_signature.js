const bip66 = require('bip66')

const fromDer = require('./from_der');

const sigHashByteLength = 1;

/** Decode signature

  {
    signature: <Signature Buffer Object>
  }

  @returns
  {
    hash_type: <Hash Type Number>
    signature: <Signature Buffer Object>
  }
*/
module.exports = ({signature}) => {
  if (!Buffer.isBuffer(signature)) {
    throw new Error('ExpectedSignatureBufferToDecode');
  }

  const buffer = signature;

  const hashType = buffer.readUInt8(buffer.length - sigHashByteLength);
  const hashTypeMod = hashType & ~0x80;

  if (hashTypeMod <= 0 || hashTypeMod >= 4) {
    throw new Error('InvalidHashType');
  }

  const decode = bip66.decode(buffer.slice(0, -sigHashByteLength));

  const r = fromDer({x: decode.r});
  const s = fromDer({x: decode.s});

  return {hash_type: hashType, signature: Buffer.concat([r, s], 64)};
};

