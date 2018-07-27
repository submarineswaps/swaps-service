const {encode} = require('bip66');

const derEncode = require('./der_encode');

const pointSize = 32;

/** Encode a signature

  {
    flag: <Signature Hash Flag Number>
    signature: <Signature Hex String>
  }

  @returns
  <Encoded Signature Buffer>
*/
module.exports = ({flag, signature}) => {
  const hashType = Buffer.from([flag]);
  const sEnd = pointSize + pointSize;
  const sig = Buffer.from(signature, 'hex');

  const r = derEncode({point: sig.slice(0, pointSize).toString('hex')});
  const s = derEncode({point: sig.slice(pointSize, sEnd).toString('hex')});

  return Buffer.concat([encode(r, s), hashType]);
};


