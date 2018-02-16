const byteLength = 1;
const scriptNumberMax = 75;

/** Number as a Buffer for script pushdata

  Note: only accepts low numbers.

  {
    number: <Convert To Buffer Number>
  }

  @returns
  <Buffer>
*/
module.exports = (args) => {
  if (!args || !args.number || args.number > scriptNumberMax) {
    throw new Error('Expected low number to convert to script buffer');
  }

  const buf = Buffer(byteLength);

  buf.writeUInt8(args.number);

  return buf;
};

