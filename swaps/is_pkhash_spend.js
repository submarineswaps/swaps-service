const {decompile} = require('bitcoinjs-lib').script;

const payToPublicKeyLength = 2;
const pubKeyLength = 33;
const sigMaxLength = 72;

/** Determine if script or witness elements indicate payment to a pk hash

  {
    script: <Input Script Signature Buffer>
    witness: [<Input Witness Stack Buffer>]
  }

  @returns
  <Is a Public Key Hash Spend Bool>
*/
module.exports = ({script, witness}) => {
  const isWitness = Array.isArray(witness) && !!witness.length;

  const scriptElements = isWitness ? witness : decompile(script);

  if (scriptElements.length !== payToPublicKeyLength) {
    return false;
  }

  const [sig, pubKey] = scriptElements;

  return pubKey.length === pubKeyLength && sig.length <= sigMaxLength;
};


