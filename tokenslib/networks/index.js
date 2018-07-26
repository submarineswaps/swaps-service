const bcashregtest = require('./bcashregtest');
const bchtestnet = require('./bchtestnet');
const bcoinregtest = require('./bcoinregtest');
const bitcoin = require('./bitcoin');
const ltc = require('./ltc');
const ltcregtest = require('./ltcregtest');
const ltctestnet = require('./ltctestnet');
const regtest = require('./regtest');
const testnet = require('./testnet');

/** Supported network attributes
*/
module.exports = {
  bcashregtest,
  bchtestnet,
  bcoinregtest,
  bitcoin,
  ltc,
  ltcregtest,
  ltctestnet,
  regtest,
  testnet,
};

