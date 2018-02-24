const bip65Encode = require('bip65').encode;
const {address, crypto, ECPair, networks, script} = require('bitcoinjs-lib');
const {Transaction} = require('bitcoinjs-lib');

const chain = require('./../conf/chain');

const hashAll = Transaction.SIGHASH_ALL;
const {testnet} = networks;
const {toOutputScript} = address;
const {sha256} = crypto;
const {witnessScriptHash} = script;

const ecdsaSignatureLength = chain.ecdsa_sig_max_byte_length;
const sequenceLength = chain.sequence_byte_length;
const shortPushdataLength = chain.short_push_data_length;
const vRatio = chain.witness_byte_discount_denominator;

/** Make a claim chain swap output transaction that completes a swap

  {
    current_block_height: <Current Block Height Number>
    destination: <Send Tokens to Address String>
    fee_tokens_per_vbyte: <Fee Per Virtual Byte Token Rate Number>
    preimage: <Payment Preimage Hex String>
    private_key: <Claim Private Key WIF String>
    utxos: [{
      redeem: <Redeem Script Buffer>
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

  const preimage = Buffer.from(args.preimage, 'hex');
  const signingKey = ECPair.fromWIF(args.private_key, testnet);
  const tokens = args.utxos.reduce((sum, n) => n.tokens + sum, 0);
  const tokensPerVirtualByte = args.fee_tokens_per_vbyte;
  const tx = new Transaction();

  args.utxos
    .map(n => ({txId: Buffer.from(n.transaction_id, 'hex'), vout: n.vout}))
    .forEach(n => tx.addInput(n.txId.reverse(), n.vout));

  tx.addOutput(toOutputScript(args.destination, testnet), tokens);

  tx.locktime = bip65Encode({blocks: args.current_block_height});

  // Anticipate the final weight of the transaction
  const anticipatedWeight = args.utxos.reduce((sum, utxo) => {
    return [
      shortPushdataLength,
      ecdsaSignatureLength,
      shortPushdataLength,
      preimage.length,
      sequenceLength,
      utxo.redeem.length,
      sum,
    ].reduce((sum, n) => sum + n);
  },
  tx.weight());

  // Reduce the final output value to give some tokens over to fees
  const [out] = tx.outs;

  out.value -= tokensPerVirtualByte * Math.ceil(anticipatedWeight / vRatio);

  // Sign each input
  args.utxos.forEach(({redeem, tokens}, i) => {
    const sigHash = tx.hashForWitnessV0(i, redeem, tokens, hashAll);

    const signature = signingKey.sign(sigHash).toScriptSignature(hashAll);

    return [[signature, preimage, redeem]]
      .forEach((witness, i) => tx.setWitness(i, witness));
  });

  return cbk(null, {transaction: tx.toHex()});
};

