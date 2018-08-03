const {decompile} = require('./../tokenslib').script;
const scriptElements = require('./script_elements');
const swapScriptDetails = require('./swap_script_details');

/** Determine if spend scripts match a swap spend

  {
    network: <Network Name String>
    script: <Script Signature Buffer>
    witness: [<Witness Signature Buffer>]
  }

  @returns
  <Is Swap Spend Bool>
*/
module.exports = ({network, script, witness}) => {
  const [redeemScript] = scriptElements({script, witness}).reverse();

  try {
    return !!swapScriptDetails({network, script: redeemScript});
  } catch (e) {
    return false;
  }
};

