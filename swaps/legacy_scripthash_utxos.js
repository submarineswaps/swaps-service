const {chainConstants} = require('./../chain');
const swapScriptDetails = require('./swap_script_details');

const p2shScriptPubByteLength = chainConstants.p2sh_scriptpub_byte_length;

/** Filter utxos to get only legacy pay to script hash utxos

  {
    network: <Network Name String>
    utxos: [{
      redeem: <Redeem Script Hex String>
      script: <Output Script Hex String>
      tokens: <Outpoint Tokens Number>
    }]
  }

  @throws Error on invalid arguments

  @returns
  [{
    redeem: <Redeem Script Hex String>
    vin: <Input Index Number>
  }]
*/
module.exports = ({network, utxos}) => {
  if (!network) {
    throw new Error('ExpectedNetworkForLegacyScriptHashUtxoFiltering');
  }

  if (!Array.isArray(utxos)) {
    throw new Error('ExpectedUtxosArrayToFilterForLegacyScriptHashUtxos');
  }

  const legacy = utxos.map(({redeem, script, tokens}, vin) => {
    if (Buffer.from(script, 'hex').length !== p2shScriptPubByteLength) {
      return;
    }

    const scriptDetails = swapScriptDetails({network, script: redeem});

    switch (script) {
    // Standard P2SH output script, no witness
    case (scriptDetails.p2sh_output_script):
      return {redeem, script, tokens, vin};

    case (scriptDetails.p2sh_p2wsh_output_script):
      return null;

    default:
      throw new Error('UnrecognizedPayToScriptHashScriptPub');
    }
  });

  // Return only legacy utxos
  return legacy.filter(n => !!n);
};

