const lib = require('bitcoinjs-lib');

const networks = require('./networks');

const hexBase = 16;

/** Extensions to bitcoinjs-lib to work with non-standard chains
*/
Object.keys(networks).forEach(network => {
  const chain = networks[network] || {};
  const net = lib.networks[network] || {};

  if (!!chain.prefix) {
    // Bech32 human readable prefix
    net.bech32 = chain.prefix.bech32 || '';

    // BIP 32 prefix values
    net.bip32 = {};

    net.bip32.public = parseInt(chain.prefix.bip32_public_key, hexBase);
    net.bip32.private = parseInt(chain.prefix.bip32_private_key, hexBase);

    // Signed message prefix string
    net.messagePrefix = chain.prefix.message_prefix;

    // Public key hash version prefix
    net.pubKeyHash = parseInt(chain.prefix.p2pkh, hexBase);

    // Script hash version prefix
    net.scriptHash = parseInt(chain.prefix.p2sh, hexBase);

    // WIF version prefix
    net.wif = parseInt(chain.prefix.wif, hexBase);
  }

  // Sighash fork id value
  net.fork_id = chain.fork_id || null;

  // Uses cash address types?
  net.is_cash_address_network = !!chain.is_cash_address_network;

  // Is missing RBF?
  net.is_rbf_disabled = chain.is_rbf_disabled || false;

  // Is missing SegWit?
  net.is_segwit_absent = chain.is_segwit_absent || false;

  // Time in ms per block
  net.ms_per_block = chain.ms_per_block;

  lib.networks[network] = net;

  return;
});

module.exports = lib;

