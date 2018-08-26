const {Transaction} = require('bitcoinjs-lib');

const defaultTransactionVersionNumber = 2;
const encodePsbt = require('./encode_psbt');
const {global} = require('./types');

/** Create a PSBT

  {
    outputs: [{
      script: <Output ScriptPub Hex String>
      tokens: <Sending Tokens Number>
    }]
    utxos: [{
      transaction_id: <Transaction Id Hex String>
      vout: <Output Index Number>
    }]
    [version]: <Transaction Version Number>
  }

  @returns
  {
    psbt: <Partially Signed Bitcoin Transaction Hex Encoded String>
  }
*/
module.exports = ({outputs, utxos, version}) => {
  if (!Array.isArray(outputs)) {
    throw new Error('ExpectedTransactionOutputsForNewPsbt');
  }

  if (!Array.isArray(utxos)) {
    throw new Error('ExpectedTransactionInputsForNewPsbt');
  }

  const tx = new Transaction();

  tx.version = version || defaultTransactionVersionNumber;

  // Push all the unsigned inputs into the transaction
  utxos
    .map(n => ({hash: Buffer.from(n.transaction_id, 'hex'), vout: n.vout}))
    .forEach(({hash, vout}) => tx.addInput(hash.reverse(), vout));

  // Append all the outputs to the transaction
  outputs
    .map(({script, tokens}) => ({tokens, script: Buffer.from(script, 'hex')}))
    .forEach(({script, tokens}) => tx.addOutput(script, tokens));

  const unsignedTransactionPair = {
    type: Buffer.from(global.unsigned_tx, 'hex'),
    value: tx.toBuffer(),
  };

  const pairs = [unsignedTransactionPair];

  // Each input and output is represented as an empty key value pair
  outputs.concat(utxos).forEach(({}) => pairs.push({}));

  return encodePsbt({pairs});
};

