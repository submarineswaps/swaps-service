const bitcoinjsLib = require('bitcoinjs-lib');

const {testnet} = bitcoinjsLib.networks;
const {TransactionBuilder} = bitcoinjsLib;

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
  const keyPair = bitcoinjsLib.ECPair.fromWIF(args.private_key, testnet);

  const transactionBuilder = new TransactionBuilder(testnet);

  transactionBuilder.addInput(args.spend_transaction_id, args.spend_vout);
  transactionBuilder.addOutput(args.destination, args.tokens);

  transactionBuilder.sign(0, keyPair);

  return cbk(null, {transaction: transactionBuilder.build().toHex()});
};

