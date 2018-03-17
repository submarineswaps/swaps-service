const uuidv4 = require('uuid/v4');

const preimage = new Buffer(32);
const uuidv4ByteCount = 16;

// Populate preimage bytes with a couple uuidv4s
uuidv4({}, preimage);
uuidv4({}, preimage, uuidv4ByteCount);

console.log('FAKED PREIMAGE', preimage.toString('hex'));

/** Pay Lightning Invoice

  {
    invoice: <Invoice String>
  }

  @returns via cbk
  {
    payment_secret: <Payment Preimage Hex String>
  }
*/
module.exports = (args, cbk) => {
  return cbk(null, {
    payment_secret: preimage.toString('hex'),
  });
};

