const byteLength = 1;
const scriptNumberMax = 75;
const scriptNumberMin = 0;

/** Number as a Buffer for script pushdata

  Note: only accepts low numbers.

  {
    number: <Convert To Buffer Number>
  }

  @throws
  <Error> when number is incorrect

  @returns
  <Buffer>
*/
module.exports = ({number}) => {
  if (number > scriptNumberMax) {
    throw new Error('ExpectedLowNumber');
  }

  if (number < scriptNumberMin) {
    throw new Error('ExpectedHigherNumber');
  }

  const buf = Buffer(byteLength);

  buf.writeUInt8(number);

  return buf;
};

