const {max} = Math;

const BN = require('bn.js');
const {OP_0} = require('bitcoin-ops');

const {chainConstants} = require('./../chain');
const {createPsbt} = require('./../bip174');
const {crypto} = require('./../tokenslib');
const {decodePsbt} = require('./../bip174');
const estimateWeightWithInputs = require('./estimate_weight_with_inputs');
const outputScriptForAddress = require('./output_script_for_address');
const {script} = require('./../tokenslib');
const swapScriptDetails = require('./swap_script_details');
const {Transaction} = require('./../tokenslib');
const {updatePsbt} = require('./../bip174');

const decBase = 10;
const {decompile} = script;
const dummyPublicKey = '000000000000000000000000000000000000000000000000000000000000000000';
const dummySkipFlag = '00';
const {hash160} = crypto;
const minSequence = chainConstants.min_sequence_value;
const {sha256} = crypto;
const {SIGHASH_ALL} = Transaction;
const vRatio = 4;

/** Make an unsigned refund PSBT

  {
    fee_tokens_per_vbyte: <Tokens to Assign To Fees Per Virtual Byte Number>
    network: <Network Name String>
    [refund_address]: <Send Refund Tokens to Address String>
    [transactions]: [<Transaction Hex String>]
    [utxos]: [{
      redeem: <Witness or Redeem Script Hex String>
      script: <ScriptPub Hex String>
      tokens: <Tokens Number>
      [transaction_id]: <Transaction Id String>
      [vout]: <Vout Number>
    }]
  }

  @throws
  <Unsigned Refund PSBT Creation Error>

  @returns
  {
    psbt: <BIP 174 PSBT String>
  }
*/
module.exports = args => {
  const {network} = args;

  if (!network) {
    throw new Error('ExpectedNetworkForRefundPsbtCreation');
  }

  let destinationScript;
  const redeemScripts = [];
  const tokens = args.utxos.reduce((sum, {tokens}) => tokens + sum, 0);
  const witnessScripts = [];

  const timelock = max(args.utxos.map(({redeem}) => {
    const scriptDetails = swapScriptDetails({network, script: redeem});

    return scriptDetails.timelock_block_height;
  }));

  const [utxo] = args.utxos;

  const {type} = swapScriptDetails({network, script: utxo.redeem});

  // Nested redeem scripts
  args.utxos.forEach(({redeem, script}) => {
    const redeemScript = Buffer.from(redeem, 'hex');
    const [,scriptHash] = decompile(Buffer.from(script, 'hex'));

    if (hash160(redeemScript).equals(scriptHash)) {
      return redeemScripts.push(redeem);
    }

    const witnessScriptHash = sha256(redeemScript);

    if (witnessScriptHash.equals(scriptHash)) {
      return witnessScripts.push(redeem);
    }

    const nestedRedeemScript = Buffer.concat([
      new BN(OP_0, decBase).toArrayLike(Buffer),
      new BN(witnessScriptHash.length, decBase).toArrayLike(Buffer),
      witnessScriptHash,
    ]);

    redeemScripts.push(nestedRedeemScript.toString('hex'));
    witnessScripts.push(redeem);

    return;
  });

  try {
    destinationScript = outputScriptForAddress({
      network,
      address: args.refund_address,
    });
  } catch (err) {
    throw new Error('InvalidRefundAddressArgumentsForRefundPsbt');
  }

  const utxos = args.utxos.map(n => ({
    id: n.transaction_id,
    sequence: minSequence,
    vout: n.vout,
  }));

  const blankPsbt = createPsbt({
    utxos,
    outputs: [{script: destinationScript, tokens: tokens}],
  });

  const blankTx = decodePsbt({psbt: blankPsbt.psbt}).unsigned_transaction;

  let estimatedWeight;
  let refundPush;

  switch (type) {
  case 'pk':
    refundPush = dummySkipFlag;
    break;

  case 'pkhash':
    refundPush = dummyPublicKey;
    break;

  default:
    throw new Error('UnexpectedSwapScriptType');
  }

  try {
    estimatedWeight = estimateWeightWithInputs({
      network: args.network,
      utxos: args.utxos,
      unlock: refundPush,
      weight: Transaction.fromHex(blankTx).weight(),
    });
  } catch (err) {
    throw err;
  }

  const fee = args.fee_tokens_per_vbyte * Math.ceil(estimatedWeight / vRatio);

  const psbtWithFeeAndTimelock = createPsbt({
    utxos,
    timelock,
    outputs: [{script: destinationScript, tokens: tokens - fee}],
  });

  return updatePsbt({
    psbt: psbtWithFeeAndTimelock.psbt,
    redeem_scripts: redeemScripts,
    transactions: args.transactions,
    witness_scripts: witnessScripts,
  });
};

