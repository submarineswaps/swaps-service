const BN = require('bn.js');
const {crypto} = require('bitcoinjs-lib');
const {OP_0} = require('bitcoin-ops');
const {script} = require('bitcoinjs-lib');
const {Transaction} = require('bitcoinjs-lib');
const varuint = require('varuint-bitcoin');

const decBase = 10;
const decodePsbt = require('./decode_psbt');
const {decompile} = script;
const {hash160} = crypto;

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

  decoded.outputs.forEach((n, vout) => {
    if (!!n.bip32_derivation) {
      const pkHash = hash160(Buffer.from(n.bip32_derivation.public_key, 'hex'));

      const scriptPub = Buffer.concat([
        new BN(OP_0, decBase).toArrayLike(Buffer),
        varuint.encode(pkHash.length),
        pkHash,
      ]);

      tx.outs[vout].script = scriptPub;
    }

    return;
  });

  return {transaction: tx.toHex()};
};

