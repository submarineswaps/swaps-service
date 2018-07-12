const {chainConstants} = require('./../chain');
const swapScriptDetails = require('./swap_script_details');

const ecdsaSignatureLength = chainConstants.ecdsa_sig_max_byte_length;
const sequenceLength = chainConstants.sequence_byte_length;
const shortPushdataLength = chainConstants.short_push_data_length;

/** Estimate the weight of a transaction after signed SegWit inputs are added

  {
    network: <Network Name String>
    utxos: [{
      redeem: <Redeem Script Hex String>
      script: <Output Script Hex String>
    }]
    unlock: <Claim Preimage, Refund Pubkey, Dummy Preimage Hex String>
    weight: <Weight Without Signed Inputs Number>
  }

  @throws Error on invalid arguments

  @returns
  <Estimated Weight Number>
*/
module.exports = ({network, unlock, utxos, weight}) => {
  if (!network) {
    throw new Error('ExpectedNetworkForWeightEstimation');
  }

  if (unlock === undefined) {
    throw new Error('ExpectedUnlockElementForInputWeightEstimation');
  }

  if (!Array.isArray(utxos)) {
    throw new Error('ExpectedUtxosForWeightEstimation');
  }

  if (!weight) {
    throw new Error('ExpectedUnsignedTxWeightForInputWeightEstimation');
  }

  return utxos.reduce((sum, {redeem, script}) => {
    const scriptDetails = swapScriptDetails({network, script: redeem});

    // Exit early as legacy p2sh has no additional witness weight
    if (script === scriptDetails.p2sh_output_script) {
      return sum;
    }

    return [
      shortPushdataLength,
      ecdsaSignatureLength,
      !!unlock ? shortPushdataLength : [].length,
      Buffer.from(unlock, 'hex').length,
      sequenceLength,
      Buffer.from(redeem, 'hex').length,
      sum,
    ].reduce((sum, n) => sum + n);
  },
  weight);
};

