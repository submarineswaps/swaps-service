const {createHash} = require('crypto');

const uuidv4 = require('uuid/v4');

const preimageByteCount = 32;
const uuidv4ByteCount = 16;

/** Generate a fake invoice payment preimage and payment hash pair

  {}

  @returns via cbk
  {
    payment_hash: <Payment Hash Hex String>
    payment_preimage: <Payment Preimage Hex String>
  }
*/
module.exports = (args, cbk) => {
  const preimage = new Buffer(preimageByteCount);

  // Populate preimage bytes with a couple uuidv4s
  uuidv4({}, preimage);
  uuidv4({}, preimage, uuidv4ByteCount);

  return cbk(null, {
    payment_hash: createHash('sha256').update(preimage).digest('hex'),
    payment_preimage: preimage.toString('hex'),
  });
};

