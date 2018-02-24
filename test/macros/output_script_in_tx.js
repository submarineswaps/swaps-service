const {crypto, script, Transaction} = require('bitcoinjs-lib');

const {sha256} = crypto;
const {witnessScriptHash} = script;

/** Find outputs with matching script in transaction

  {
    redeem_script: <Redeem Script For ScriptPub Hex String>
    transaction: <Transaction Hex String>
  }

  @returns via cbk
  {
    matching_outputs: [{
      redeem: <Redeem Script Buffer>
      script: <ScriptPub Buffer>
      tokens: <Tokens Number>
      transaction_id: <Transaction Id Hex String>
      vout: <Vout Number>
    }]
  }
*/
module.exports = (args, cbk) => {
  if (!args.redeem_script || !args.transaction) {
    return cbk([0, 'Expected redeem script, transaction']);
  }

  const redeem = Buffer.from(args.redeem_script, 'hex');
  const transaction = Transaction.fromHex(args.transaction);

  const txId = transaction.getId();
  const witnessScript = witnessScriptHash.output.encode(sha256(redeem));

  const matchingVouts = transaction.outs
    .map(({script, value}, vout) => {
      return {redeem, script, vout, tokens: value, transaction_id: txId};
    })
    .filter(n => n.script.equals(witnessScript));

  return cbk(null, {matching_outputs: matchingVouts});
};

