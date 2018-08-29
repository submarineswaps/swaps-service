const {script} = require('bitcoinjs-lib');
const {Transaction} = require('bitcoinjs-lib');

const decodePsbt = require('./decode_psbt');
const {decompile} = script;

/** Extract a transaction from a finalized PSBT

  {
    psbt: <BIP 174 Encoded PSBT Hex String>
  }

  @throws
  <Extract Transaction Error>

  @returns
  {
    transaction: <Hex Serialized Transaction String>
  }
*/
module.exports = ({psbt}) => {
  let decoded;

  try {
    decoded = decodePsbt({psbt});
  } catch (err) {
    throw err;
  }

  const tx = Transaction.fromHex(decoded.unsigned_transaction);

  decoded.inputs.forEach((n, vin) => {
    if (!n.final_scriptsig && !n.final_scriptwitness) {
      throw new Error('ExpectedFinalScriptSigsAndWitnesses');
    }

    if (!!n.final_scriptsig) {
      tx.setInputScript(vin, Buffer.from(n.final_scriptsig, 'hex'));
    }

    if (!!n.final_scriptwitness) {
      const finalScriptWitness = Buffer.from(n.final_scriptwitness, 'hex');

      const witnessElements = decompile(finalScriptWitness).map(n => {
        return !n ? Buffer.from([]) : n;
      });

      tx.setWitness(vin, decompile(witnessElements));
    }

    return;
  });

  return {transaction: tx.toHex()};
};

