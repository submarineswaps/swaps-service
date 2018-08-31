const {max} = Math;

const BN = require('bn.js');
const {OP_0} = require('bitcoin-ops');

const {chainConstants} = require('./../chain');
const {createPsbt} = require('./../bip174');
const {crypto} = require('./../tokenslib');
const outputScriptForAddress = require('./output_script_for_address');
const swapScriptDetails = require('./swap_script_details');
const {Transaction} = require('./../tokenslib');
const {updatePsbt} = require('./../bip174');

const decBase = 10;
const minSequence = chainConstants.min_sequence_value;
const {sha256} = crypto;
const {SIGHASH_ALL} = Transaction;

/** Make an unsigned refund PSBT

  {
    network: <Network Name String>
    [refund_address]: <Send Refund Tokens to Address String>
    [transactions]: [<Transaction Hex String>]
    [utxos]: [{
      script: <ScriptPub Hex String>
      tokens: <Tokens Number>
      [transaction_id]: <Transaction Id String>
      [vout]: <Vout Number>
      witness: <Witness Script Hex String>
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
  if (!args.network) {
    throw new Error('ExpectedNetworkForRefundPsbtCreation');
  }

  let destinationScript;
  const tokens = args.utxos.reduce((sum, {tokens}) => tokens + sum, 0);
  const witnesses = args.utxos.map(({witness}) => witness);

  const timelock = max(args.utxos.map(n => {
    const scriptDetails = swapScriptDetails({
      network: args.network,
      script: n.witness,
    });

    return scriptDetails.timelock_block_height;
  }));

  const redeems = args.utxos.map(({witness}) => {
    const witnessScriptHash = sha256(Buffer.from(witness, 'hex'));

    const nestedRedeemScript = Buffer.concat([
      new BN(OP_0, decBase).toArrayLike(Buffer),
      new BN(witnessScriptHash.length, decBase).toArrayLike(Buffer),
      witnessScriptHash,
    ]);

    return nestedRedeemScript.toString('hex');
  });

  try {
    destinationScript = outputScriptForAddress({
      address: args.refund_address,
      network: args.network,
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
    outputs: [{
      script: destinationScript,
      tokens: tokens,
    }],
    timelock: timelock,
  });

  return updatePsbt({
    psbt: blankPsbt.psbt,
    redeem_scripts: redeems,
    transactions: args.transactions,
    witness_scripts: witnesses,
  });
};

