const zero = Buffer.alloc(1, 0);

/** DER Encode

  {
    point: <Point Hex String>
  }

  @return
  <Encoded Point Buffer>
*/
module.exports = ({point}) => {
  let i = 0;
  let x = Buffer.from(point, 'hex');

  while (x[i] === 0) {
    ++i;
  }

  if (i === x.length) {
    return zero;
  }

  x = x.slice(i);

  if (x[0] & 0x80) {
    return Buffer.concat([zero, x], 1 + x.length);
  } else {
    return x;
  }
};

