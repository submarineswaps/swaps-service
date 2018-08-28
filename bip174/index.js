const combinePsbts = require('./combine_psbts');
const createPsbt = require('./create_psbt');
const decodePsbt = require('./decode_psbt');
const extractTransaction = require('./extract_transaction');
const finalizePsbt = require('./finalize_psbt');
const signPsbt = require('./sign_psbt');
const updatePsbt = require('./update_psbt');

/** BIP 174 Partially Signed Bitcoin Transaction Decoding and Encoding
*/
module.exports = ({
  combinePsbts,
  createPsbt,
  decodePsbt,
  extractTransaction,
  finalizePsbt,
  signPsbt,
  updatePsbt,
});

