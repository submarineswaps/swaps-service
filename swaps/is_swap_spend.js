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
  const elements = scriptElements({script, witness});

  if (!Array.isArray(elements)) {
    return false;
  }

  const redeem = !!witness && !witness.length ? elements[2] : elements[0];
  const secret = elements[1];

  if (!secret) {
    return false;
  }

  try {
    return !!swapScriptDetails({network, script: redeem});
  } catch (err) {
    return false;
  }
};

