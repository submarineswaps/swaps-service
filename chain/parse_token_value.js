const decBase = 10;
const divisibility = 1e8;

/** Parse token value from a fractional string

  @param
  {
    value: <Token Big Unit Value String>
  }

  @throws
  <Error When Conversion Fails>

  @returns
  {
    tokens: <Tokens Number>
  }
*/
module.exports = ({value}) => {
  if (typeof value !== 'string') {
    throw new Error('ExpectedDefinedValue');
  }

  return {
    tokens: parseInt(
      (parseFloat(value, decBase) * divisibility).toFixed(),
      decBase
    ),
  };
};

