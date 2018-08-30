const BN = require('bn.js');
const {OP_PUSHDATA1} = require('bitcoin-ops');
const {OP_PUSHDATA2} = require('bitcoin-ops');
const {OP_PUSHDATA4} = require('bitcoin-ops');
const pushdata = require('pushdata-bitcoin');
const varuint = require('varuint-bitcoin');

const decBase = 10;
const endianness = 'le';

/** Get a push data buffer for data to push on the stack

  {
    [data]: <Data to Encode in Push Data Buffer>
    [encode]: <Data to Encode In Push Data Hex String>
  }

  @throws
  <Encode Data As Push Data Error>

  @returns
  <Push Data Buffer>
*/
module.exports = ({data, encode}) => {
  const dataToEncode = data || Buffer.from(encode, 'hex');

  const dataLength = dataToEncode.length;
  const bufferLength = new Buffer(pushdata.encodingLength(dataLength)).length;

  switch (bufferLength) {
  case 1:
    return Buffer.concat([
      new BN(dataLength).toArrayLike(Buffer),
      dataToEncode,
    ]);

  case 2:
    return Buffer.concat([
      new BN(OP_PUSHDATA1, decBase).toArrayLike(Buffer),
      new BN(dataLength, decBase).toArrayLike(Buffer),
      dataToEncode,
    ]);

  case 3:
    return Buffer.concat([
      new BN(OP_PUSHDATA2, decBase).toArrayLike(Buffer),
      new BN(dataLength, decBase).toArrayLike(Buffer, endianness, 2),
      dataToEncode,
    ]);

  case 5:
    return Buffer.concat([
      new BN(OP_PUSHDATA4, decBase).toArrayLike(Buffer),
      new BN(dataLength, decBase).toArrayLike(Buffer, endianness, 4),
      dataToEncode,
    ]);

  default:
    throw new Error('UnexpectedLengthForDataPush');
  }
};

