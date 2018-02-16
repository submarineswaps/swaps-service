const {ECPair, networks, TransactionBuilder} = require('bitcoinjs-lib');

const {testnet} = networks;

/** Send some tokens to an address

  {
    destination: <Destination Address String>
    private_key: <WIF Serialized Private Key String>
    spend_transaction_id: <Transaction Id to Spend Hex String>
    spend_vout: <Vout to Spend Number>
    tokens: <Tokens to Send Number>
  }

  @returns via cbk
  {
    transaction: <Transaction Hex Serialized String>
  }
*/
module.exports = (args, cbk) => {
  const keyPair = ECPair.fromWIF(args.private_key, testnet);
  const txBuilder = new TransactionBuilder(testnet);

  txBuilder.addInput(args.spend_transaction_id, args.spend_vout);
  txBuilder.addOutput(args.destination, args.tokens);

  [keyPair].forEach((k, i) => txBuilder.sign(i, k));

  return cbk(null, {transaction: txBuilder.build().toHex()});
};

