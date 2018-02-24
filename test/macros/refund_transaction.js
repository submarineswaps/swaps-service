const bip65Encode = require('bip65').encode;
const {address, crypto, ECPair, networks, script} = require('bitcoinjs-lib');
const {OP_FALSE} = require('bitcoin-ops');
const {Transaction} = require('bitcoinjs-lib');

const chain = require('./../conf/chain');
const errCode = require('./../conf/error_codes');
const hexBase = require('./../conf/math').hex_base;

const {SIGHASH_ALL} = Transaction;
const {sha256} = crypto;
const {testnet} = networks;
const {toOutputScript} = address;
const {witnessScriptHash} = script;

const ecdsaSignatureLength = chain.ecdsa_sig_max_byte_length;
const minSequence = chain.min_sequence_value;
const sequenceLength = chain.sequence_byte_length;
const shortPushdataLength = chain.short_push_data_length;
const vRatio = chain.witness_byte_discount_denominator;

/** Build a refund transaction to claim funds back from a swap

  {
    current_block_height: <Current Block Height Number>
    destination: <Send Tokens to Address String>
    fee_tokens_per_vbyte: <Fee Per Virtual Byte Token Rate Number>
    [is_public_key_hash_refund]: <Is Public Key Hash Refund Bool> = false
    private_key: <Refund Private Key WIF String>
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
    return cbk([errCode.local_err, 'Expected funding tx utxos']);
  }

  const dummy = Buffer.from(OP_FALSE.toString(hexBase), 'hex');
  const isPkHashRefund = !!args.is_public_key_hash_refund;
  const signingKey = ECPair.fromWIF(args.private_key, testnet);
  const tokens = args.utxos.reduce((sum, n) => n.tokens + sum, 0);
  const tokensPerVirtualByte = args.fee_tokens_per_vbyte;
  const tx = new Transaction();

  tx.addOutput(toOutputScript(args.destination, testnet), tokens);

  // Plug all the utxos into the transaction as inputs
  args.utxos
    .map(n => ({txId: Buffer.from(n.transaction_id, 'hex'), vout: n.vout}))
    .forEach(n => tx.addInput(n.txId.reverse(), n.vout));

  // OP_CLTV prohibits final sequence use
  tx.ins.forEach(txIn => txIn.sequence = minSequence);

  tx.locktime = bip65Encode({blocks: args.current_block_height});

  // In place of the preimage a dummy spacer byte or a public key is placed
  const space = isPkHashRefund ? dummy : signingKey.getPublicKeyBuffer();

  // Anticipate the final weight of the transaction
  const anticipatedWeight = args.utxos.reduce((sum, utxo) => {
    return [
      shortPushdataLength,
      ecdsaSignatureLength,
      sequenceLength,
      (isPkHashRefund ? shortPushdataLength : 0),
      space.length,
      utxo.redeem.length,
      sum,
    ].reduce((sum, n) => sum + n);
  },
  tx.weight());

  // Reduce the final output value to give some tokens over to fees
  const [out] = tx.outs;

  out.value -= tokensPerVirtualByte * Math.ceil(anticipatedWeight / vRatio);

  // Sign each input. We need the dummy to fail the preimage test
  args.utxos.forEach(({redeem, tokens}, i) => {
    const sigHash = tx.hashForWitnessV0(i, redeem, tokens, SIGHASH_ALL);

    const signature = signingKey.sign(sigHash).toScriptSignature(SIGHASH_ALL);

    return [[signature, space, redeem]].forEach((w, i) => tx.setWitness(i, w));
  });

  return cbk(null, {transaction: tx.toHex()});
};

