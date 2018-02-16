const bitcoinjsLib = require('bitcoinjs-lib');

const addressFromOutputScript = bitcoinjsLib.address.fromOutputScript;
const encodeScriptHash = bitcoinjsLib.script.scriptHash.output.encode;
const hash160 = bitcoinjsLib.crypto.hash160;
const sha256 = bitcoinjsLib.crypto.sha256;
const testnet = bitcoinjsLib.networks.testnet;
const witnessScriptHash = bitcoinjsLib.script.witnessScriptHash;

const chainSwapScript = require('./chain_swap_script');

/** Derive a chain swap address for a swap

  {
    destination_public_key: <Destination Public Key Serialized String>
    payment_hash: <Payment Hash String>
    refund_public_key: <Refund Public Key Serialized String>
    timeout_block_count: <Swap Expiration Date Number>
  }

  @returns via cbk
  {
    p2sh_p2wsh_address: <Nested Pay to Witness Script Address String>
    p2wsh_address: <Pay to Witness Script Hash Address String>
    redeem_script: <Redeem Script Hex String>
  }
*/
module.exports = (args, cbk) => {
  const redeemScriptHex = chainSwapScript({
    destination_public_key: args.destination_public_key,
    payment_hash: args.payment_hash,
    refund_public_key: args.refund_public_key,
    timeout_block_count: args.timeout_block_count,
  });

  const redeemScript = Buffer.from(redeemScriptHex, 'hex');

  // The witness program is part of the scriptPub: "pay to this script hash"
  const witnessProgram = witnessScriptHash.output.encode(sha256(redeemScript));

  // When wrapping for legacy p2sh, the program is hashed more and with RIPE160
  const p2shWrappedWitnessProgram = encodeScriptHash(hash160(witnessProgram));

  const p2shAddr = addressFromOutputScript(p2shWrappedWitnessProgram, testnet);

  return cbk(null, {
    p2sh_p2wsh_address: p2shAddr,
    p2wsh_address: addressFromOutputScript(witnessProgram, testnet),
    redeem_script: redeemScriptHex.toString('hex'),
  });
};

