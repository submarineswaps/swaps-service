const encodePsbt = require('./encode_psbt');
const {global} = require('./types');
const {Transaction} = require('./../tokenslib');

const defaultTransactionVersionNumber = 2;
const type = Buffer.from(global.unsigned_tx, 'hex');

/** Create a PSBT

  {
    outputs: [{
      script: <Output ScriptPub Hex String>
      tokens: <Sending Tokens Number>
    }]
    utxos: [{
      id: <Transaction Id Hex String>
      [sequence]: <Sequence Number>
      vout: <Output Index Number>
    }]
    [timelock]: <Set Lock Time on Transaction To Number>
    [version]: <Transaction Version Number>
  }

  @returns
  {
    psbt: <Partially Signed Bitcoin Transaction Hex Encoded String>
  }
*/
module.exports = ({outputs, timelock, utxos, version}) => {
  if (!Array.isArray(outputs)) {
    throw new Error('ExpectedTransactionOutputsForNewPsbt');
  }

  if (!Array.isArray(utxos)) {
    throw new Error('ExpectedTransactionInputsForNewPsbt');
  }

  // Construct a new transaction that will be the basis of the PSBT
  const tx = new Transaction();

  tx.locktime = timelock || undefined;
  tx.version = version || defaultTransactionVersionNumber;

  // Push all the unsigned inputs into the transaction
  utxos
    .map(({id, vout}) => ({vout, hash: Buffer.from(id, 'hex')}))
    .forEach(({hash, vout}) => tx.addInput(hash.reverse(), vout));

  // Set sequence numbers as necessary
  utxos
    .filter(({sequence}) => sequence !== undefined)
    .forEach(({sequence}, vin) => tx.ins[vin].sequence = sequence);

  // Append all the outputs to the transaction
  outputs
    .map(({script, tokens}) => ({tokens, script: Buffer.from(script, 'hex')}))
    .forEach(({script, tokens}) => tx.addOutput(script, tokens));

  // Initialize the type value pairs with the transaction
  const pairs = [{type, value: tx.toBuffer()}, {separator: true}];

  // Each input and output is represented as an empty key value pair
  outputs.concat(utxos).forEach(({}) => pairs.push({separator: true}));

  return encodePsbt({pairs});
};

