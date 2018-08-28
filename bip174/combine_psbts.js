const {script} = require('bitcoinjs-lib');

const decodePsbt = require('./decode_psbt');
const updatePsbt = require('./update_psbt');

const encodeSig = script.signature.encode;

/** Combine multiple PSBTs
  {
    psbts: [<BIP 174 Encoded PSBT Hex String>]
  }
  @throws
  <Combine PSBT Error>
  @returns
  {
    psbt: <BIP 174 Encoded PSBT Hex String>
  }
*/
module.exports = ({psbts}) => {
  const signatures = [];
  const [referencePsbt] = psbts;

  psbts.map(psbt => decodePsbt({psbt})).forEach(decoded => {
    return decoded.inputs.forEach((input, vin) => {
      return input.partial_sig.forEach(partial => {
        const sig = Buffer.from(partial.signature, 'hex');

        return signatures.push({
          vin,
          hash_type: partial.hash_type,
          public_key: partial.public_key,
          signature: encodeSig(sig, partial.hash_type),
        });
      });
    });
  });

  try {
    return updatePsbt({signatures, psbt: referencePsbt});
  } catch (err) {
    throw err;
  }
};
