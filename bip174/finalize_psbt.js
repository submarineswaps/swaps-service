const updatePsbt = require('./update_psbt');

/** Finalize the inputs of a PSBT
  {
    psbt: <BIP 174 Encoded PSBT Hex String>
  }

  @throws
  <Finalize PSBT Error>

  @returns
  {
    psbt: <BIP 174 Encoded PSBT Hex String>
  }
*/
module.exports = ({psbt}) => {
  return updatePsbt({is_final: true, psbt});
};

