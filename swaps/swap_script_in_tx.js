const {crypto} = require('./../tokenslib');
const {script} = require('./../tokenslib');
const swapScriptDetails = require('./swap_script_details');
const {Transaction} = require('./../tokenslib');

const encodeScriptHash = script.scriptHash.output.encode;
const {hash160} = crypto;
const {sha256} = crypto;
const {witnessScriptHash} = script;

const notFound = -1;

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
      script: <ScriptPub Hex String>
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

  const outputScripts = [
    encodeScriptHash(hash160(redeem)),
    encodeScriptHash(hash160(p2wshScript)),
    p2wshScript,
  ]
    .map(n => n.toString('hex'));

  const matchingOutputs = transaction.outs
    .map(({script, value}, vout) => {
      return {
        vout,
        redeem: redeem.toString('hex'),
        script: script.toString('hex'),
        tokens: value,
        transaction_id: txId,
      };
    })
    .filter(({script}) => outputScripts.indexOf(script) !== notFound);

  return {matching_outputs: matchingOutputs};
};

