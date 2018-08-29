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
  const additionalAttributes = [];
  const globalAttributes = {};
  const inputAttributes = [];
  const outputAttributes = [];
  const [referencePsbt] = psbts;
  const signatures = [];

  psbts.map(psbt => decodePsbt({psbt})).forEach(decoded => {
    (decoded.unrecognized_attributes || []).forEach(({type, value}) => {
      return globalAttributes[type] = value;
    });

    decoded.inputs.forEach((input, vin) => {
      (input.unrecognized_attributes || []).forEach(({type, value}) => {
        inputAttributes[vin] = inputAttributes[vin] || {};

        return inputAttributes[vin][type] = value;
      });

      return (input.partial_sig || []).forEach(partial => {
        const sig = Buffer.from(partial.signature, 'hex');

        return signatures.push({
          vin,
          hash_type: partial.hash_type,
          public_key: partial.public_key,
          signature: encodeSig(sig, partial.hash_type),
        });
      });
    });

    decoded.outputs.forEach((output, vout) => {
      return (output.unrecognized_attributes || []).forEach(pair => {
        outputAttributes[vout] = outputAttributes[vout] || {};

        return outputAttributes[vout][pair.type] = pair.value;
      });
    });

    return;
  });

  Object.keys(globalAttributes).sort().forEach(type => {
    return additionalAttributes.push({type, value: globalAttributes[type]});
  });

  inputAttributes.forEach((attributes, vin) => {
    Object.keys(attributes).sort().forEach(type => {
      return additionalAttributes.push({type, vin, value: attributes[type]});
    });
  });

  outputAttributes.forEach((attributes, vout) => {
    Object.keys(attributes).sort().forEach(type => {
      return additionalAttributes.push({type, vout, value: attributes[type]});
    });
  });

  try {
    return updatePsbt({
      signatures,
      additional_attributes: additionalAttributes,
      psbt: referencePsbt,
    });
  } catch (err) {
    throw err;
  }
};
