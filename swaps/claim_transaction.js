const {address} = require('bitcoinjs-lib');
const bip65Encode = require('bip65').encode;
const {crypto} = require('bitcoinjs-lib');
const {ECPair} = require('bitcoinjs-lib');
const {networks} = require('bitcoinjs-lib');
const {OP_0} = require('bitcoin-ops');
const {script} = require('bitcoinjs-lib');
const {Transaction} = require('bitcoinjs-lib');

const chainConstants = require('./../chain').constants;
const numberAsBuffer = require('./number_as_buffer');
const scriptBuffersAsScript = require('./script_buffers_as_script');

const {hash160} = crypto;
const hashAll = Transaction.SIGHASH_ALL;
const {sha256} = crypto;
const {testnet} = networks;
const {toOutputScript} = address;
const {witnessScriptHash} = script;

const dustRatio = 1 / 3;
const ecdsaSignatureLength = chainConstants.ecdsa_sig_max_byte_length;
const hexCharCountPerByte = 2;
const minSequenceValue = chainConstants.min_sequence_value
const nestedScriptPubHexLength = 46;
const sequenceLength = chainConstants.sequence_byte_length;
const shortPushdataLength = chainConstants.short_push_data_length;
const vRatio = chainConstants.witness_byte_discount_denominator;

/** Make a claim chain swap output transaction that completes a swap

  {
    current_block_height: <Current Block Height Number>
    destination: <Send Tokens to Address String>
    fee_tokens_per_vbyte: <Fee Per Virtual Byte Token Rate Number>
    is_p2sh: <Is Nested P2SH Bool> = false
    preimage: <Payment Preimage Hex String>
    private_key: <Claim Private Key WIF String>
    utxos: [{
      redeem: <Redeem Script Hex String>
      [script]: <Script Pub Hex String>
      tokens: <Tokens Number>
      transaction_id: <Transaction Id String>
      vout: <Vout Number>
    }]
  }

  @throws
  <Error> on invalid arguments

  @returns
  {
    transaction: <Sweep Transaction Hex Serialized String>
  }
*/
module.exports = args => {
  if (!args.current_block_height) {
    throw new Error('ExpectedCurrentBlockHeight');
  }

  if (!args.destination) {
    throw new Error('ExpectedDestination');
  }

  if (!args.fee_tokens_per_vbyte) {
    throw new Error('ExpectedFeeTokensPerVbyte');
  }

  if (!args.preimage) {
    throw new Error('ExpectedPreimage');
  }

  if (!args.private_key) {
    throw new Error('ExpectedPrivateKey');
  }

  if (!args.utxos.length) {
    throw new Error('ExpectedFundingUtxos');
  }

  const preimage = Buffer.from(args.preimage, 'hex');
  const signingKey = ECPair.fromWIF(args.private_key, testnet);
  const tokens = args.utxos.reduce((sum, n) => n.tokens + sum, 0);
  const tokensPerVirtualByte = args.fee_tokens_per_vbyte;
  const tx = new Transaction();

  // Add each UTXO as an input
  args.utxos
    .map(n => ({txId: Buffer.from(n.transaction_id, 'hex'), vout: n.vout}))
    .forEach(n => tx.addInput(n.txId.reverse(), n.vout));

  tx.addOutput(toOutputScript(args.destination, testnet), tokens);
  tx.ins.forEach(n => n.sequence = minSequenceValue);
  tx.locktime = bip65Encode({blocks: args.current_block_height});

  args.utxos.forEach(({redeem, script}, i) => {
    if (script.length !== nestedScriptPubHexLength) {
      return;
    }

    const redeemScript = Buffer.from(redeem, 'hex');
    const witnessVersion = numberAsBuffer({number: OP_0}).toString('hex');

    const nestComponents = [witnessVersion, sha256(redeemScript)];

    const nest = Buffer.from(scriptBuffersAsScript(nestComponents), 'hex');

    tx.setInputScript(i, Buffer.from(scriptBuffersAsScript([nest]), 'hex'));

    return;
  });

  // Anticipate the final weight of the transaction
  const anticipatedWeight = args.utxos.reduce((sum, utxo) => {
    return [
      shortPushdataLength,
      ecdsaSignatureLength,
      shortPushdataLength,
      preimage.length,
      sequenceLength,
      utxo.redeem.length / hexCharCountPerByte,
      sum,
    ].reduce((sum, n) => sum + n);
  },
  tx.weight());

  const feeSum = tokensPerVirtualByte * Math.ceil(anticipatedWeight / vRatio);

  // Exit early when the ratio of the amount spent on fees would be too high
  if (feeSum > tokens || feeSum / (tokens - feeSum) > dustRatio) {
    throw new Error('FeesTooHighToClaim');
  }

  // Reduce the final output value to give some tokens over to fees
  const [out] = tx.outs;

  out.value -= feeSum;

  // Sign each input and include the normal redeem script for nested p2sh
  args.utxos.forEach(({redeem, tokens}, i) => {
    const redeemScript = Buffer.from(redeem, 'hex');

    const sigHash = tx.hashForWitnessV0(i, redeemScript, tokens, hashAll);

    const signature = signingKey.sign(sigHash).toScriptSignature(hashAll);

    return [[signature, preimage, redeemScript]]
      .forEach((witness, i) => tx.setWitness(i, witness));
  });

  return {transaction: tx.toHex()};
};

