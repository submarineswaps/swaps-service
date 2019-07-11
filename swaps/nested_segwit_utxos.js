const chainConstants = require('./../chain/conf/constants');
const swapScriptDetails = require('./swap_script_details');

const p2shScriptPubByteLength = chainConstants.p2sh_scriptpub_byte_length;

/** Filter utxos to get only nested SegWit utxos

  {
    network: <Network Name String>
    utxos: [{
      redeem: <Redeem Script Hex String>
      script: <Output Script Hex String>
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
    throw new Error('ExpectedNetworkForNestedSegwitUtxoFiltering');
  }

  if (!Array.isArray(utxos)) {
    throw new Error('ExpectedUtxosArray');
  }

  const nested = utxos.map(({redeem, script}, vin) => {
    if (Buffer.from(script, 'hex').length !== p2shScriptPubByteLength) {
      return;
    }

    const scriptDetails = swapScriptDetails({network, script: redeem});

    switch (script) {
    // Standard P2SH output script, no witness
    case (scriptDetails.p2sh_output_script):
      return null;

    case (scriptDetails.p2sh_p2wsh_output_script):
      return {redeem, vin};

    default:
      throw new Error('UnrecognizedScriptPub');
    }
  });

  // Return only nested utxos
  return nested.filter(n => !!n);
};

