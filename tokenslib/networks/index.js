const bcashregtest = require('./bcashregtest');
const bchtestnet = require('./bchtestnet');
const bcoinregtest = require('./bcoinregtest');
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
  ltcregtest,
  ltctestnet,
  regtest,
  testnet,
};

