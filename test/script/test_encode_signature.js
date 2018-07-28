const {test} = require('tap');

const {encodeSignature} = require('./../../script');
const {Transaction} = require('./../../tokenslib');

const {SIGHASH_ALL} = Transaction;

const tests = [
  {
    args: {
      flag: SIGHASH_ALL,
      signature: '4e45e16932b8af514961a1d3a1a25fdf3f4f7732e9d624c6c61548ab5fb8cd41181522ec8eca07de4860a4acdd12909d831cc56cbbac4622082221a8768d1d09',
    },
    expected: '304402204e45e16932b8af514961a1d3a1a25fdf3f4f7732e9d624c6c61548ab5fb8cd410220181522ec8eca07de4860a4acdd12909d831cc56cbbac4622082221a8768d1d0901',
    purpose: 'Valid signature - r+s significant bits 0',
  },
  {
    args: {
      flag: SIGHASH_ALL,
      signature: '82235e21a2300022738dabb8e1bbd9d19cfb1e7ab8c30a23b0afbb8d178abcf324bf68e256c534ddfaf966bf908deb944305596f7bdcc38d69acad7f9c868724',
    },
    expected: '304502210082235e21a2300022738dabb8e1bbd9d19cfb1e7ab8c30a23b0afbb8d178abcf3022024bf68e256c534ddfaf966bf908deb944305596f7bdcc38d69acad7f9c86872401',
    purpose: 'Valid signature, r significant bit 1',
  },
  {
    args: {
      flag: SIGHASH_ALL,
      signature: '1cadddc2838598fee7dc35a12b340c6bde8b389f7bfd19a1252a17c4b5ed2d71c1a251bbecb14b058a8bd77f65de87e51c47e95904f4c0e9d52eddc21c1415ac',
    },
    expected: '304502201cadddc2838598fee7dc35a12b340c6bde8b389f7bfd19a1252a17c4b5ed2d71022100c1a251bbecb14b058a8bd77f65de87e51c47e95904f4c0e9d52eddc21c1415ac01',
    purpose: 'Valid signature, s significant bit 1',
  },
  {
    args: {
      flag: SIGHASH_ALL,
      signature: '1b19519b38ca1e6813cd25649ad36be8bc6a6f2ad9758089c429acd9ce0b572f3bf32193c8a3a3de1f847cd6e6eebf43c96df1ffa4d7fe920f8f71708920c65f',
    },
    expected: '304402201b19519b38ca1e6813cd25649ad36be8bc6a6f2ad9758089c429acd9ce0b572f02203bf32193c8a3a3de1f847cd6e6eebf43c96df1ffa4d7fe920f8f71708920c65f01',
    purpose: 'Valid signature',
  },
];

tests.forEach(({args, expected, purpose}) => {
  return test(purpose, t => {
    t.equal(encodeSignature(args).toString('hex'), expected);

    return t.end();
  });
});

