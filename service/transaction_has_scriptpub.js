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
  return getTransaction({
    network: args.network,
    transaction_id: args.transaction_id,
  },
  (err, res) => {
    if (!!err) {
      return cbk(err);
    }

    const scriptPubs = args.output_scripts.map(n => Buffer.from(n, 'hex'));
    let tx;

    try { tx = Transaction.fromHex(res.transaction); } catch (e) {
      return cbk([503, 'ExpectedValidTransactionHex']);
    }

    const hasScriptPub = tx.outs
      .map(n => n.script)
      .find(script => scriptPubs.find(n => script.equals(n)));

    return cbk(null, !!hasScriptPub);
  });
};

