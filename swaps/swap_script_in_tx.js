const {crypto} = require('./../tokenslib');
const {p2shOutputScript} = require('./../script');
const {p2shP2wshOutputScript} = require('./../script');
const {p2wshOutputScript} = require('./../script');
const swapScriptDetails = require('./swap_script_details');
const {Transaction} = require('./../tokenslib');

const {hash160} = crypto;
const notFound = -1;
const {sha256} = crypto;

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

  const p2sh = p2shOutputScript({script: args.redeem_script});
  const p2shP2wsh = p2shP2wshOutputScript({script: args.redeem_script});
  const p2wsh = p2wshOutputScript({script: args.redeem_script});
  const redeem = Buffer.from(args.redeem_script, 'hex');
  const transaction = Transaction.fromHex(args.transaction);

  const txId = transaction.getId();

  const outputScripts = [p2sh, p2shP2wsh, p2wsh].map(n => n.toString('hex'));

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

