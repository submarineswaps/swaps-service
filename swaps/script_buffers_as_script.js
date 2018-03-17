const numberAsBuf = require('./number_as_buffer');

const hexBase = 16;

/** Convert an array of script buffer elements to a fully formed script

  @param
  [<Script Element Buffer>, <Script OP_CODE Decimal Number>]

  @throws
  <Error> when a script element length exceeds maximum

  @returns
  <Script Hex>
*/
module.exports = scriptElements => {
   // Convert numbers to buffers and hex data to pushdata
  const fullScript = scriptElements
    .map(element => {
      if (Buffer.isBuffer(element)) {
        return Buffer.concat([numberAsBuf({number: element.length}), element]);
      } else {
        return Buffer.from(element.toString(hexBase), 'hex');
      }
    })
    .reduce((element, script) => Buffer.concat([element, script]));

  return fullScript.toString('hex');
};

