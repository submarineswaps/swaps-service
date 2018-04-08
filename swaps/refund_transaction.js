const bip65Encode = require('bip65').encode;
const {address} = require('bitcoinjs-lib');
const {crypto} = require('bitcoinjs-lib');
const {ECPair} = require('bitcoinjs-lib');
const {networks} = require('bitcoinjs-lib');
const {OP_0} = require('bitcoin-ops');
const {OP_FALSE} = require('bitcoin-ops');
const {OP_PUSHDATA1} = require('bitcoin-ops');
const {script} = require('bitcoinjs-lib');
const {Transaction} = require('bitcoinjs-lib');

const chain = require('./../chain').constants;
const numberAsBuffer = require('varuint-bitcoin').encode;
const scriptBuffersAsScript = require('./script_buffers_as_script');
const swapScriptDetails = require('./swap_script_details');

const {SIGHASH_ALL} = Transaction;
const {sha256} = crypto;
const {testnet} = networks;
const {toOutputScript} = address;
const {witnessScriptHash} = script;

const compressedPubKeySize = chain.compressed_public_key_size;
const dustRatio = 1 / 3;
const ecdsaSignatureLength = chain.ecdsa_sig_max_byte_length;
const hexBase = 16;
const hexCharCountPerByte = 2;
const minSequence = chain.min_sequence_value;
const nestedScriptPubHexLength = 46;
const sequenceLength = chain.sequence_byte_length;
const shortPushdataLength = chain.short_push_data_length;
const vRatio = chain.witness_byte_discount_denominator;

/** Build a refund transaction to claim funds back from a swap

  {
    destination: <Send Tokens to Address String>
    fee_tokens_per_vbyte: <Fee Per Virtual Byte Token Rate Number>
    [is_public_key_hash_refund]: <Is Public Key Hash Refund Bool> = false
    [private_key]: <Refund Private Key WIF String>
    timelock_block_height: <Timelock Block Height Number>
    utxos: [{
      redeem: <Redeem Script Hex String>
      script: <ScriptPub Hex String>
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
  if (!args.destination) {
    throw new Error('ExpectedDestination');
  }

  if (!args.fee_tokens_per_vbyte) {
    throw new Error('ExpectedFee');
  }

  if (!args.timelock_block_height) {
    throw new Error('ExpectedLocktimeHeight');
  }

  if (!Array.isArray(args.utxos) || !args.utxos.length) {
    throw new Error('ExpectedUTXOs');
  }

  const dummy = Buffer.from(OP_FALSE.toString(hexBase), 'hex');
  const isPkHashRefund = !!args.is_public_key_hash_refund;
  let pubKey;
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

  tx.locktime = bip65Encode({blocks: args.timelock_block_height});

  // Add redeem scripts for nested p2sh
  args.utxos.forEach(({redeem, script}, i) => {
    if (script.length !== nestedScriptPubHexLength) {
      return;
    }

    const scriptDetails = swapScriptDetails({redeem_script: redeem});

    if (script === scriptDetails.p2sh_output_script) {
      return;
    }

    if (script !== scriptDetails.p2sh_p2wsh_output_script) {
      throw new Error('UnrecognizedScriptPub');
    }

    const redeemScript = Buffer.from(redeem, 'hex');
    const witnessVersion = numberAsBuffer(OP_0).toString('hex');

    const nestComponents = [witnessVersion, sha256(redeemScript)];

    const nest = Buffer.from(scriptBuffersAsScript(nestComponents), 'hex');

    tx.setInputScript(i, Buffer.from(scriptBuffersAsScript([nest]), 'hex'));

    return;
  });

  // The public key buffer is stubbed all zeros when there is no private key
  if (!!args.private_key) {
    pubKey = ECPair.fromWIF(args.private_key, testnet).getPublicKeyBuffer();
  } else {
    pubKey = Buffer.alloc(compressedPubKeySize);
  }

  // In place of the preimage a dummy spacer byte or a public key is placed
  const space = !isPkHashRefund ? dummy : pubKey;

  // Set legacy p2sh signatures
  args.utxos.forEach(({redeem, script}, i) => {
    if (script.length !== nestedScriptPubHexLength) {
      return;
    }

    const scriptDetails = swapScriptDetails({redeem_script: redeem});

    if (script === scriptDetails.p2sh_p2wsh_output_script) {
      return;
    }

    if (script !== scriptDetails.p2sh_output_script) {
      throw new Error('UnrecognizedScriptPub');
    }

    const dummyKey = ECPair.makeRandom();
    const redeemScript = Buffer.from(redeem, 'hex');

    const sigHash = tx.hashForSignature(i, redeemScript, SIGHASH_ALL);

    const sig = dummyKey.sign(sigHash).toScriptSignature(SIGHASH_ALL);

    const pushDatas = scriptBuffersAsScript([sig, space]);

    const inputScript = Buffer.concat([
      Buffer.from(pushDatas, 'hex'),
      space,
      numberAsBuffer(OP_PUSHDATA1),
      numberAsBuffer(redeemScript.length),
      redeemScript,
    ]);

    tx.setInputScript(i, Buffer.from(inputScript, 'hex'));

    return;
  });

  // Anticipate the final weight of the transaction
  const anticipatedWeight = args.utxos.reduce((sum, utxo) => {
    const scriptDetails = swapScriptDetails({redeem_script: utxo.redeem});

    if (utxo.script === scriptDetails.p2sh_output_script) {
      return sum;
    }

    return [
      shortPushdataLength,
      ecdsaSignatureLength,
      sequenceLength,
      (isPkHashRefund ? shortPushdataLength : 0),
      space.length,
      utxo.redeem.length / hexCharCountPerByte,
      sum,
    ].reduce((sum, n) => sum + n);
  },
  tx.weight());

  const feeSum = tokensPerVirtualByte * Math.ceil(anticipatedWeight / vRatio);

  // Exit early when the ratio of the amount spent on fees would be too high
  if (feeSum > tokens || feeSum / (tokens - feeSum) > dustRatio) {
    throw new Error('RefundOutputTooSmall');
  }

  // Reduce the final output value to give some tokens over to fees
  const [out] = tx.outs;

  out.value -= feeSum;

  // Exit early when there is no private key to sign the refund inputs
  if (!args.private_key) {
    return {transaction: tx.toHex()};
  }

  const signingKey = ECPair.fromWIF(args.private_key, testnet);

  // Set legacy p2sh signatures
  args.utxos.forEach(({redeem, script}, i) => {
    if (script.length !== nestedScriptPubHexLength) {
      return;
    }

    const scriptDetails = swapScriptDetails({redeem_script: redeem});

    if (script === scriptDetails.p2sh_p2wsh_output_script) {
      return;
    }

    if (script !== scriptDetails.p2sh_output_script) {
      throw new Error('UnrecognizedScriptPub');
    }

    const redeemScript = Buffer.from(redeem, 'hex');

    const sigHash = tx.hashForSignature(i, redeemScript, SIGHASH_ALL);

    const sig = signingKey.sign(sigHash).toScriptSignature(SIGHASH_ALL);

    const pushDatas = scriptBuffersAsScript([sig, space]);

    const inputScriptElements = [sig, space, OP_PUSHDATA1, redeemScript];

    const inputScript = scriptBuffersAsScript(inputScriptElements);

    tx.setInputScript(i, Buffer.from(inputScript, 'hex'));

    return;
  });

  // Sign each input. We need the dummy to fail the preimage test
  args.utxos.forEach(({redeem, script, tokens}, i) => {
    const redeemScript = Buffer.from(redeem, 'hex');
    const scriptDetails = swapScriptDetails({redeem_script: redeem});

    if (script === scriptDetails.p2sh_output_script) {
      return;
    }

    const isNested = script.length === nestedScriptPubHexLength;

    if (isNested) {
      const witnessVersion = numberAsBuffer(OP_0).toString('hex');

      const nestComponents = [witnessVersion, sha256(redeemScript)];

      const nest = Buffer.from(scriptBuffersAsScript(nestComponents), 'hex');

      tx.setInputScript(i, Buffer.from(scriptBuffersAsScript([nest]), 'hex'));
    }

    const sigHash = tx.hashForWitnessV0(i, redeemScript, tokens, SIGHASH_ALL);

    const sig = signingKey.sign(sigHash).toScriptSignature(SIGHASH_ALL);

    return [[sig, space, redeemScript]].forEach((w, i) => tx.setWitness(i, w));
  });

  return {transaction: tx.toHex()};
};

