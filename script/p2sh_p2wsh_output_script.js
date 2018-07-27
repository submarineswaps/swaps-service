const p2shOutputScript = require('./p2sh_output_script');
const p2wshOutputScript = require('./p2wsh_output_script');

/** Get P2SH Nested P2WSH Output Script

  {
    script: <Redeem Script Hex String>
  }

  @returns
  <P2SH Output Script Buffer>
*/
module.exports = ({script}) => {
  const witnessProgram = p2wshOutputScript({script});

  return p2shOutputScript({script: witnessProgram.toString('hex')});
};

