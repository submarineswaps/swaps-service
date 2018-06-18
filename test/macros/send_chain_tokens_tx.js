const {ECPair} = require('./../../tokenslib');
const {networks} = require('./../../tokenslib');
const {TransactionBuilder} = require('./../../tokenslib');

const {address} = require('./../../tokenslib');

/** Send some tokens to an address

  {
    destination: <Destination Address String>
    network: <Network Name String>
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
  if (!args.destination) {
    return cbk([400, 'ExpectedDestinationAddressToSendTokensTo']);
  }

  if (!args.network) {
    return cbk([400, 'ExpectedNetworkToSendChainTokens']);
  }

  if (!args.private_key) {
    return cbk([400, 'ExpectedPrivateKeyToAuthorizeSend']);
  }

  if (!args.spend_transaction_id) {
    return cbk([400, 'ExpectedOutpointTxIdToSpend']);
  }

  if (args.spend_vout === undefined) {
    return cbk([400, 'ExpectedOutpointVoutToSpend']);
  }

  if (!args.tokens) {
    return cbk([400, 'ExpectedTokenCountToSend']);
  }

  const network = networks[args.network];

  const keyPair = ECPair.fromWIF(args.private_key, network);
  const txBuilder = new TransactionBuilder(network);

  txBuilder.addInput(args.spend_transaction_id, args.spend_vout);

  try {
    txBuilder.addOutput(args.destination, args.tokens);
  } catch (e) {
    return cbk([400, 'ErrorAddingOutput', e]);
  }

  [keyPair].forEach((k, i) => txBuilder.sign(i, k));

  return cbk(null, {transaction: txBuilder.build().toHex()});
};

