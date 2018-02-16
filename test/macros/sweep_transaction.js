const bip65Encode = require('bip65').encode;
const bitcoinjsLib = require('bitcoinjs-lib');
const {Transaction} = require('bitcoinjs-lib');

const addressToOutputScript = bitcoinjsLib.address.toOutputScript;
const hashAll = Transaction.SIGHASH_ALL;
const {testnet} = bitcoinjsLib.networks;
const {sha256} = bitcoinjsLib.crypto;
const {witnessScriptHash} = bitcoinjsLib.script;

const ecdsaSignatureLength = 72;
const sequenceLength = 4;
const shortPushdataLength = 1;
const vRatio = 4;

/** Sweep chain swap output

  {
    current_block_height: <Current Block Height Number>
    destination: <Send Tokens to Address String>
    fee_tokens_per_vbyte: <Fee Per Virtual Byte Token Rate Number>
    redeem_script: <Redeem Script Hex>
    preimage: <Payment Preimage Hex String>
    private_key: <Claim Private Key WIF String>
    redeem_script: <Redeem Script Hex Serialized String>
    utxos: [{
      tokens: <Tokens Number>
      transaction_id: <Transaction Id String>
      vout: <Vout Number>
    }]
  }

  @returns via cbk
  {
    transaction: <Sweep Transaction Hex Serialized String>
  }
*/
module.exports = (args, cbk) => {
  if (!args.utxos.length) {
    return cbk([0, 'Expected funding tx utxos']);
  }

  const lockTime = bip65Encode({blocks: args.current_block_height});
  const preimage = Buffer.from(args.preimage, 'hex');
  const script = Buffer.from(args.redeem_script, 'hex');
  const scriptPub = addressToOutputScript(args.destination, testnet);
  const signingKey = bitcoinjsLib.ECPair.fromWIF(args.private_key, testnet);
  const tokens = args.utxos.reduce((sum, n) => n.tokens + sum, 0);
  const tokensPerVirtualByte = args.fee_tokens_per_vbyte;
  const transaction = new Transaction();

  args.utxos
    .map(n => ({txId: Buffer.from(n.transaction_id, 'hex'), vout: n.vout}))
    .forEach(n => transaction.addInput(n.txId.reverse(), n.vout));

  transaction.addOutput(scriptPub, tokens);

  const prevPub = witnessScriptHash.output.encode(sha256(script));

  const anticipatedWeight = args.utxos.reduce((sum, n) => {
    return [
      shortPushdataLength,
      ecdsaSignatureLength,
      shortPushdataLength,
      preimage.length,
      sequenceLength,
      script.length,
      sum,
    ].reduce((sum, n) => sum + n);
  },
  transaction.weight());

  const [out] = transaction.outs;

  out.value -= tokensPerVirtualByte * Math.ceil(anticipatedWeight / vRatio);

  transaction.locktime = lockTime;

  // Sign each input
  args.utxos.forEach(({tokens}, i) => {
    const sigHash = transaction.hashForWitnessV0(i, script, tokens, hashAll);

    const signature = signingKey.sign(sigHash).toScriptSignature(hashAll);

    return [[signature, preimage, script]]
      .forEach((witness, i) => transaction.setWitness(i, witness));
  });

  return cbk(null, {transaction: transaction.toHex()});
};

