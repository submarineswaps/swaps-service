const {OP_EQUAL} = require('bitcoin-ops');
const {OP_HASH160} = require('bitcoin-ops');

const {script} = require('./../tokenslib');
const {Transaction} = require('./../tokenslib');

const {decompile} = script;
const p2shHashByteLength = 20;

/** Check that an input's non witness utxo is valid

  {
    hash: <Input Redeem Script RIPEMD160 Hash Buffer Object>
    script: <Input Redeem Script Buffer Object>
    utxo: <Non-Witness UTXO Transaction Buffer Object>
  }

  @throws
  <RedeemScriptDoesNotMatchUtxo Error>
*/
module.exports = ({hash, script, utxo}) => {
  const scriptPubHashes = Transaction.fromBuffer(utxo).outs.map(out => {
    // It's expected that the scripPub be a normal P2SH script
    const [hash160, scriptHash, isEqual, extra] = decompile(out.script);

    if (hash160 !== OP_HASH160) {
      return null;
    }

    if (scriptHash.length !== p2shHashByteLength) {
      return null;
    }

    if (isEqual !== OP_EQUAL) {
      return null;
    }

    if (!!extra) {
      return null;
    }

    return scriptHash;
  });

  // Make sure the p2sh script hashes has a hash that matches the input
  if (!scriptPubHashes.find(h => !!h && h.equals(hash))) {
    throw new Error('RedeemScriptDoesNotMatchUtxo');
  }

  return;
};

