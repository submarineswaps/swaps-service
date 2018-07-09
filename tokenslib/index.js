const lib = require('bitcoinjs-lib');

const prefixes = require('./prefixes');

const hex = 16;

/** Extensions to bitcoinjs-lib to work with non-standard chains
*/
Object.keys(prefixes).forEach(chain => {
  lib.networks[chain] = {
    bech32: prefixes[chain].bech32,
    bip32: {
      public: parseInt(prefixes[chain].bip32_public_key, hex),
      private: parseInt(prefixes[chain].bip32_private_key, hex),
    },
    fork_id: prefixes[chain].fork_id || null,
    messagePrefix: prefixes[chain].message,
    pubKeyHash: parseInt(prefixes[chain].pay_to_public_key_hash_address, hex),
    scriptHash: parseInt(prefixes[chain].pay_to_script_hash_address, hex),
    wif: parseInt(prefixes[chain].wif, hex),
  };

  return;
});

module.exports = lib;

