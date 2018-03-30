const {Transaction} = require('bitcoinjs-lib');

const {getTransaction} = require('./../chain');

/** Determine if a transaction has a script pub output

  {
    output_scripts: [<Output Script Hex String>]
    network: <Network Name String>
    transaction_id: <Transaction Id String>
  }

  @returns via cbk
  <Transaction Contains Output With Scriptpub Bool>
*/
module.exports = (args, cbk) => {
  if (!Array.isArray(args.output_scripts) || !args.output_scripts.length) {
    return cbk([400, 'ExpectedOutputScripts']);
  }

  if (!args.network) {
    return cbk([400, 'ExpectedNetwork']);
  }

  if (!args.transaction_id) {
    return cbk([400, 'ExpectedTransactionId']);
  }

  return getTransaction({
    network: args.network,
    transaction_id: args.transaction_id,
  },
  (err, res) => {
    if (!!err) {
      return cbk(err);
    }

    const scriptPubs = args.output_scripts;
    let tx;

    try { tx = Transaction.fromHex(res.transaction); } catch (e) {
      return cbk([503, 'ExpectedValidTransactionHex']);
    }

    const hasScriptPub = tx.outs
      .map(n => n.script.toString('hex'))
      .find(script => args.output_scripts.find(n => script === n));

    return cbk(null, !!hasScriptPub);
  });
};

