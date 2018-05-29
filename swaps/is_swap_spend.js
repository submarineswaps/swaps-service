const {decompile} = require('bitcoinjs-lib').script;

const scriptElements = require('./script_elements');
const swapScriptDetails = require('./swap_script_details');

/** Determine if spend scripts match a swap spend

  {
    script: <Script Signature Buffer>
    witness: [<Witness Signature Buffer>]
  }

  @returns
  <Is Swap Spend Bool>
*/
module.exports = ({script, witness}) => {
  const [redeemScript] = scriptElements({script, witness}).reverse();

  try {
    return !!swapScriptDetails({redeem_script: redeemScript});
  } catch (e) {
    return false;
  }
};

