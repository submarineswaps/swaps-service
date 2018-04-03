const {address} = require('bitcoinjs-lib');
const {crypto} = require('bitcoinjs-lib');
const {networks} = require('bitcoinjs-lib');
const {script} = require('bitcoinjs-lib');

const {fromOutputScript} = address;
const encodeScriptHash = script.scriptHash.output.encode;
const {hash160} = crypto;
const {sha256} = crypto;
const {testnet} = networks;
const {witnessScriptHash} = script;

const pkSwapScript = require('./pk_swap_script');
const pkHashSwapScript = require('./pkhash_swap_script');

/** Derive a chain swap address for a swap

  @param
  {
    destination_public_key: <Destination Public Key Serialized String>
    payment_hash: <Payment Hash String>
    [refund_public_key]: <Refund Public Key Serialized String>
    [refund_public_key_hash]: <Refund Public Key Hash Hex String>
    timeout_block_height: <Swap Expiration Date Number>
  }

  @throws
  <Error> on chain address creation failure

  @returns
  {
    p2sh_output_script: <P2SH Nested Output Script Hex String>
    p2sh_p2wsh_address: <Nested Pay to Witness Script Address String>
    p2wsh_address: <Pay to Witness Script Hash Address String>
    redeem_script: <Redeem Script Hex String>
    witness_output_script: <Witness Output Script Hex String>
  }
*/
module.exports = args => {
  let redeemScriptHex;

  if (!!args.refund_public_key) {
    redeemScriptHex = pkSwapScript({
      destination_public_key: args.destination_public_key,
      payment_hash: args.payment_hash,
      refund_public_key: args.refund_public_key,
      timeout_block_height: args.timeout_block_height,
    });
  } else if (!!args.refund_public_key_hash) {
    redeemScriptHex = pkHashSwapScript({
      destination_public_key: args.destination_public_key,
      payment_hash: args.payment_hash,
      refund_public_key_hash: args.refund_public_key_hash,
      timeout_block_height: args.timeout_block_height,
    });
  } else {
    throw new Error('ExpectedRefundKey');
  }

  const redeemScript = Buffer.from(redeemScriptHex, 'hex');

  // The witness program is part of the scriptPub: "pay to this script hash"
  const witnessProgram = witnessScriptHash.output.encode(sha256(redeemScript));

  // When wrapping for legacy p2sh, the program is hashed more and with RIPE160
  const p2shWrappedWitnessProgram = encodeScriptHash(hash160(witnessProgram));

  const p2shAddr = fromOutputScript(p2shWrappedWitnessProgram, testnet);

  return {
    p2sh_output_script: p2shWrappedWitnessProgram.toString('hex'),
    p2sh_p2wsh_address: p2shAddr,
    p2wsh_address: fromOutputScript(witnessProgram, testnet),
    redeem_script: redeemScriptHex.toString('hex'),
    witness_output_script: witnessProgram.toString('hex'),
  };
};

