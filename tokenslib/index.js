const lib = require('bitcoinjs-lib');

/** Extensions to bitcoinjs-lib to work with non-standard chains
*/

lib.networks.regtest = {
  bech32: 'tb',
  bip32: {
    public: 0x043587cf,
    private: 0x04358394,
  },
  messagePrefix: '\x18Bitcoin Signed Message:\n',
  pubKeyHash: 0x6f,
  scriptHash: 0xc4,
  wif: 0xef,
};

lib.networks.ltctestnet = {
  bech32: 'tltc',
  bip32: {
    public: 0x019da462,
    private: 0x019d9cfe,
  },
  messagePrefix: '\x19Litecoin Signed Message:\n',
  pubKeyHash: 0x6f,
  scriptHash: 0x3a,
  wif: 0xef,
};

module.exports = lib;

