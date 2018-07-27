const encodeSignature = require('./encode_signature');
const p2pkhOutputScript = require('./p2pkh_output_script');
const p2shOutputScript = require('./p2sh_output_script');
const p2shP2wshOutputScript = require('./p2sh_p2wsh_output_script');
const p2wpkhOutputScript = require('./p2wpkh_output_script');
const p2wshOutputScript = require('./p2wsh_output_script');

/** Functions for Bitcoin Script
*/
module.exports = {
  encodeSignature,
  p2pkhOutputScript, // P2PKH
  p2shOutputScript, // P2SH
  p2shP2wshOutputScript, // P2SH P2WSH
  p2wpkhOutputScript, // P2WPKH
  p2wshOutputScript, // P2WSH
};

