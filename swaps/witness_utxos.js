const {chainConstants} = require('./../chain');
const {networks} = require('./../tokenslib');
const swapScriptDetails = require('./swap_script_details');

/** Filter utxos to get only nested SegWit or native SegWit utxos

  {
    network: <Network Name String>
    utxos: [{
      redeem: <Redeem Script Hex String>
      script: <Output Script Hex String>
      tokens: <Spending Outpoint Tokens Value Number>
    }]
  }

  @throws Error on invalid arguments

  @returns
  [{
    redeem: <Redeem Script Hex String>
    tokens: <Spending Outpoint Tokens Value Number>
    vin: <Input Index Number>
  }]
*/
module.exports = ({network, utxos}) => {
  if (!network) {
    throw new Error('ExpectedNetworkForSegWitUtxoFiltering');
  }

  if (!Array.isArray(utxos)) {
    throw new Error('ExpectedUtxosArrayToFilterSegWitUtxos');
  }

  const witnessUtxos = utxos.map(({redeem, script, tokens}, vin) => {
    const scriptDetails = swapScriptDetails({network, script: redeem});

    switch (script) {
    // Standard P2SH output script, no witness
    case (scriptDetails.p2sh_output_script):
      return null;

    // Witness output scripts
    default:
      return {redeem, tokens, vin};
    }
  });

  // Return only witness utxos
  return witnessUtxos.filter(n => !!n);
};

