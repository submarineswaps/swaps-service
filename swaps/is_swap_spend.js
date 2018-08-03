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
  const elements = scriptElements({script, witness});

  if (!Array.isArray(elements)) {
    return false;
  }

  const [redeemScript] = elements.reverse();

  try {
    return !!swapScriptDetails({network, script: redeemScript});
  } catch (err) {
    return false;
  }
};

