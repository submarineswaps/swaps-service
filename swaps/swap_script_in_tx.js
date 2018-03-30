const {crypto} = require('bitcoinjs-lib');
const {script} = require('bitcoinjs-lib');
const {Transaction} = require('bitcoinjs-lib');

const swapScriptDetails = require('./swap_script_details');

const encodeScriptHash = script.scriptHash.output.encode;
const {hash160} = crypto;
const {sha256} = crypto;
const {witnessScriptHash} = script;

/** Find outputs with matching script in transaction

  {
    redeem_script: <Redeem Script For ScriptPub Hex String>
    transaction: <Transaction Hex String>
  }

  @throws
  <Error> on invalid arguments

  @returns
  {
    matching_outputs: [{
      redeem: <Redeem Script Hex String>
      script: <ScriptPub Buffer>
      tokens: <Tokens Number>
      transaction_id: <Transaction Id Hex String>
      vout: <Vout Number>
    }]
  }
*/
module.exports = args => {
  if (!args.redeem_script) {
    throw new Error('ExpectedRedeemScript');
  }

  if (!args.transaction) {
    throw new Error('ExpectedTransaction');
  }

  const redeem = Buffer.from(args.redeem_script, 'hex');
  const transaction = Transaction.fromHex(args.transaction);

  const txId = transaction.getId();
  const p2wshScript = witnessScriptHash.output.encode(sha256(redeem));

  const p2shScript = encodeScriptHash(hash160(p2wshScript));

  const matchingVouts = transaction.outs
    .map(({script, value}, vout) => {
      return {
        redeem: redeem.toString('hex'),
        script,
        vout,
        tokens: value,
        transaction_id: txId,
      };
    })
    .filter(n => n.script.equals(p2wshScript) || n.script.equals(p2shScript));

  return {matching_outputs: matchingVouts};
};

