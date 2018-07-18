const {networks} = require('./../tokenslib');
const pkSwapScript = require('./pk_swap_script');
const pkHashSwapScript = require('./pkhash_swap_script');
const swapScriptDetails = require('./swap_script_details');

/** Derive a chain swap address for a swap

  @param
  {
    destination_public_key: <Destination Public Key Serialized String>
    network: <Network Name String>
    payment_hash: <Payment Hash String>
    [refund_public_key]: <Refund Public Key Serialized String>
    [refund_public_key_hash]: <Refund Public Key Hash Hex String>
    timeout_block_height: <Swap Expiration Date Number>
  }

  @throws
  <Error> on chain address creation failure

  @returns
  {
    bch_p2sh_address: <BCH P2SH Format Address String>
    p2sh_address: <Legacy P2SH Base58 Address String>
    p2sh_output_script: <Legacy P2SH Output Script Hex String>
    p2sh_p2wsh_address: <Nested Pay to Witness Script Address String>
    p2sh_p2wsh_output_script: <P2SH Nested Output Script Hex String>
    p2wsh_address: <Pay to Witness Script Hash Address String>
    redeem_script: <Redeem Script Hex String>
    witness_output_script: <Witness Output Script Hex String>
  }
*/
module.exports = args => {
  if (!args.network || !networks[args.network]) {
    throw new Error('ExpectedKnownNetworkForSwapAddress');
  }

  const network = networks[args.network];
  let redeemScriptHex;
  let scriptDetails;

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

  try {
    scriptDetails = swapScriptDetails({
      network: args.network,
      script: redeemScriptHex,
    });
  } catch (err) {
    throw err;
  }

  return {
    bch_p2sh_address: scriptDetails.bch_p2sh_address,
    p2sh_address: scriptDetails.p2sh_address,
    p2sh_output_script: scriptDetails.p2sh_output_script,
    p2sh_p2wsh_address: scriptDetails.p2sh_p2wsh_address,
    p2sh_p2wsh_output_script: scriptDetails.p2sh_p2wsh_output_script,
    p2wsh_address: scriptDetails.p2wsh_address,
    redeem_script: redeemScriptHex,
    witness_output_script: scriptDetails.witness_output_script,
  };
};

