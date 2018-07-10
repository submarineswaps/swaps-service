const bip65Encode = require('bip65').encode;

const {address} = require('./../tokenslib');
const {chainConstants} = require('./../chain');
const estimateWeightWithInputs = require('./estimate_weight_with_inputs');
const inputScriptsForLegacy = require('./input_scripts_for_legacy_p2sh');
const legacyScriptHashUtxos = require('./legacy_scripthash_utxos');
const nestedSegWitScript = require('./nested_segwit_script');
const nestedSegWitUtxos = require('./nested_segwit_utxos');
const {networks} = require('./../tokenslib');
const {script} = require('./../tokenslib');
const {Transaction} = require('./../tokenslib');
const witnessUtxos = require('./witness_utxos');
const witnessesForResolution = require('./witnesses_for_resolution');

const {toOutputScript} = address;

const dustRatio = 1 / chainConstants.dust_denominator;
const minSequenceValue = chainConstants.min_sequence_value
const vRatio = chainConstants.witness_byte_discount_denominator;

/** Make a claim chain swap output transaction that completes a swap

  {
    current_block_height: <Current Block Height Number>
    destination: <Send Tokens to Address String>
    fee_tokens_per_vbyte: <Fee Per Virtual Byte Token Rate Number>
    network: <Network Name String>
    preimage: <Payment Preimage Hex String>
    private_key: <Claim Private Key WIF String>
    utxos: [{
      redeem: <Redeem Script Hex String>
      [script]: <Script Pub Hex String> // Required for legacy P2SH
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

  if (!args.network) {
    throw new Error('ExpectedNetworkForClaimTransaction');
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

  let anticipatedWeight;
  const tokens = args.utxos.reduce((sum, n) => n.tokens + sum, 0);
  const tokensPerVirtualByte = args.fee_tokens_per_vbyte;
  const tx = new Transaction();
  const {utxos} = args;

  // Add each UTXO as an input
  args.utxos
    .map(n => ({txId: Buffer.from(n.transaction_id, 'hex'), vout: n.vout}))
    .forEach(n => tx.addInput(n.txId.reverse(), n.vout));

  // Add the sweep destination as an output script
  tx.addOutput(toOutputScript(args.destination, networks[args.network]), tokens);

  // Set input sequence values to non-final
  tx.ins.forEach(n => n.sequence = minSequenceValue);

  // Set a transaction locktime
  tx.locktime = bip65Encode({blocks: args.current_block_height});

  // Nested SegWit P2SH: Set nested redeem scripts
  try {
    nestedSegWitUtxos({utxos, network: args.network})
      .map(({redeem, vin}) => ({vin, redeem: nestedSegWitScript({redeem})}))
      .map(({redeem, vin}) => ({vin, redeem: Buffer.from(redeem, 'hex')}))
      .forEach(({redeem, vin}) => tx.setInputScript(vin, redeem));
  } catch (err) {
    throw err;
  }

  // Legacy P2SH: Set input scripts for p2sh utxos for fee calculation purposes
  try {
    const legacyUtxos = inputScriptsForLegacy({
      key: args.private_key,
      network: args.network,
      transaction: tx.toHex(),
      unlock: args.preimage,
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
      unlock: args.preimage,
      utxos: utxos.map(({redeem, script}) => ({redeem, script})),
      weight: tx.weight(),
    });
  } catch (err) {
    throw err;
  }

  const feeSum = tokensPerVirtualByte * Math.ceil(anticipatedWeight / vRatio);

  // Exit early when the ratio of the amount spent on fees would be too high
  if (feeSum > tokens || feeSum / (tokens - feeSum) > dustRatio) {
    throw new Error('FeesTooHighToClaim');
  }

  // Reduce the final output value to give some tokens over to fees
  const [out] = tx.outs;

  out.value -= feeSum;

  // Legacy P2SH: Set final input scripts with proper signatures
  try {
    const legacyUtxos = inputScriptsForLegacy({
      key: args.private_key,
      network: args.network,
      transaction: tx.toHex(),
      unlock: args.preimage,
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
      unlock: args.preimage,
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

