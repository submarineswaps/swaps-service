const bip65Encode = require('bip65').encode;
const {OP_FALSE} = require('bitcoin-ops');

const {chainConstants} = require('./../chain');
const {crypto} = require('./../tokenslib');
const {ECPair} = require('./../tokenslib');
const estimateWeightWithInputs = require('./estimate_weight_with_inputs');
const inputScriptsForLegacy = require('./input_scripts_for_legacy_p2sh');
const legacyScriptHashUtxos = require('./legacy_scripthash_utxos');
const {networks} = require('./../tokenslib');
const nestedSegWitScript = require('./nested_segwit_script');
const nestedSegWitUtxos = require('./nested_segwit_utxos');
const outputScriptForAddress = require('./output_script_for_address');
const {script} = require('./../tokenslib');
const scriptBuffersAsScript = require('./script_buffers_as_script');
const swapScriptDetails = require('./swap_script_details');
const {Transaction} = require('./../tokenslib');
const witnessUtxos = require('./witness_utxos');
const witnessesForResolution = require('./witnesses_for_resolution');

const compressedPubKeySize = chainConstants.compressed_public_key_size;
const dustRatio = 1 / 3;
const hexBase = 16;
const minSequence = chainConstants.min_sequence_value;
const vRatio = chainConstants.witness_byte_discount_denominator;

/** Build a refund transaction to claim funds back from a swap

  {
    destination: <Send Tokens to Address String>
    fee_tokens_per_vbyte: <Fee Per Virtual Byte Token Rate Number>
    [is_public_key_hash_refund]: <Is Public Key Hash Refund Bool> = false
    network: <Network Name String>
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

  if (!args.network || !networks[args.network]) {
    throw new Error('ExpectedNetworkForRefundTransaction');
  }

  if (!args.timelock_block_height) {
    throw new Error('ExpectedLocktimeHeight');
  }

  if (!Array.isArray(args.utxos) || !args.utxos.length) {
    throw new Error('ExpectedUTXOs');
  }

  let anticipatedWeight;
  let destinationScript;
  const dummy = Buffer.from(OP_FALSE.toString(hexBase), 'hex');
  const isPkHashRefund = !!args.is_public_key_hash_refund;
  const network = networks[args.network];
  let pubKey;
  const tokens = args.utxos.reduce((sum, n) => n.tokens + sum, 0);
  const tokensPerVirtualByte = args.fee_tokens_per_vbyte;
  const tx = new Transaction();
  const {utxos} = args;

  try {
    destinationScript = outputScriptForAddress({
      address: args.destination,
      network: args.network,
    });
  } catch (err) {
    throw err;
  }

  // Add the refund address as an output script
  tx.addOutput(Buffer.from(destinationScript, 'hex'), tokens);

  // Plug all the utxos into the transaction as inputs
  args.utxos
    .map(n => ({txId: Buffer.from(n.transaction_id, 'hex'), vout: n.vout}))
    .forEach(n => tx.addInput(n.txId.reverse(), n.vout));

  // OP_CLTV prohibits final sequence use
  tx.ins.forEach(txIn => txIn.sequence = minSequence);

  // Set transaction locktime which will be needed for OP_CLTV
  tx.locktime = bip65Encode({blocks: args.timelock_block_height});

  // Add redeem scripts for nested p2sh
  try {
    nestedSegWitUtxos({utxos, network: args.network})
      .map(({redeem, vin}) => ({vin, redeem: nestedSegWitScript({redeem})}))
      .map(({redeem, vin}) => ({vin, redeem: Buffer.from(redeem, 'hex')}))
      .forEach(({redeem, vin}) => tx.setInputScript(vin, redeem));
  } catch (err) {
    throw err;
  }

  // The public key buffer is stubbed all zeros when there is no private key
  if (!!args.private_key) {
    pubKey = ECPair.fromWIF(args.private_key, network).getPublicKeyBuffer();
  } else {
    pubKey = Buffer.alloc(compressedPubKeySize);
  }

  // In place of the preimage a dummy spacer 0 byte or a public key is placed
  const unlock = !isPkHashRefund ? dummy : pubKey;

  // Legacy P2SH: Set input scripts for p2sh utxos for fee calculation purposes
  try {
    const legacyUtxos = inputScriptsForLegacy({
      key: args.private_key,
      network: args.network,
      transaction: tx.toHex(),
      unlock: unlock.toString('hex'),
      utxos: legacyScriptHashUtxos({utxos, network: args.network}),
    });

    legacyUtxos
      .map(({script, vin}) => ({vin, script: Buffer.from(script, 'hex')}))
      .forEach(({script, vin}) => tx.setInputScript(vin, script));
  } catch (err) {
    throw err;
  }

  // Guess at the final weight of the transaction for fee/vbyte calculation
  try {
    anticipatedWeight = estimateWeightWithInputs({
      network: args.network,
      unlock: unlock.toString('hex'),
      utxos: utxos.map(({redeem, script}) => ({redeem, script})),
      weight: tx.weight(),
    });
  } catch (err) {
    throw err;
  }

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

  // Legacy P2SH: Set input scripts for p2sh utxos for fee calculation purposes
  try {
    const legacyUtxos = inputScriptsForLegacy({
      key: args.private_key,
      network: args.network,
      transaction: tx.toHex(),
      unlock: unlock.toString('hex'),
      utxos: legacyScriptHashUtxos({utxos, network: args.network}),
    });

    legacyUtxos
      .map(({script, vin}) => ({vin, script: Buffer.from(script, 'hex')}))
      .forEach(({script, vin}) => tx.setInputScript(vin, script));
  } catch (err) {
    throw err;
  }

  // Witness and Nested Witness P2SH: Set signed witnesses
  try {
    const segwitUtxos = witnessesForResolution({
      key: args.private_key,
      network: args.network,
      transaction: tx.toHex(),
      unlock: unlock.toString('hex'),
      utxos: witnessUtxos({network: args.network, utxos}),
    });

    segwitUtxos
      .map(({vin, witness}) => ({i: vin, w: witness}))
      .map(({i, w}) => ({i, witness: w.map(n => Buffer.from(n, 'hex'))}))
      .forEach(({i, witness}) => tx.setWitness(i, witness));
  } catch (err) {
    throw err;
  }

  return {transaction: tx.toHex()};
};

