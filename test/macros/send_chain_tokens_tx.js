const {encode} = require('varuint-bitcoin');

const {address} = require('./../../tokenslib');
const {crypto} = require('./../../tokenslib');
const {ECPair} = require('./../../tokenslib');
const {networks} = require('./../../tokenslib');
const {script} = require('./../../tokenslib');
const scriptBufAsScript = require('./../../swaps/script_buffers_as_script');
const {Transaction} = require('./../../tokenslib');
const {TransactionBuilder} = require('./../../tokenslib');

const hexBase = 16;
const {SIGHASH_ALL} = Transaction;

/** Send some tokens to an address

  {
    destination: <Destination Address String>
    fee: <Fee Tokens Number>
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
    txBuilder.addOutput(args.destination, (args.tokens - (args.fee || 0)));
  } catch (e) {
    return cbk([400, 'ErrorAddingOutput', e]);
  }

  [keyPair].forEach((k, i) => txBuilder.sign(i, k));

  const forkModifier = parseInt(network.fork_id || 0, hexBase);
  const transaction = txBuilder.build().toHex();
  const sigHashAll = parseInt(SIGHASH_ALL, hexBase);

  const tx = Transaction.fromHex(transaction);

  [keyPair].forEach((signingKey, vin) => {
    const sigHashFlag = !forkModifier ? sigHashAll : sigHashAll | forkModifier;

    const publicKey = signingKey.getPublicKeyBuffer();

    const hash = crypto.hash160(publicKey);

    const scriptPub = script.pubKeyHash.output.encode(hash);

    let sigHash;

    if (!!forkModifier) {
      sigHash = tx.hashForWitnessV0(vin, scriptPub, args.tokens, sigHashFlag);
    } else {
      sigHash = tx.hashForSignature(vin, scriptPub, sigHashFlag);
    }

    const sig = signingKey.sign(sigHash);

    const signature = Buffer.concat([sig.toDER(), Buffer.from([sigHashFlag])]);

    const sigPush = Buffer.concat([encode(signature.length), signature]);
    const pubKeyPush = Buffer.concat([encode(publicKey.length), publicKey]);

    const scriptSig = Buffer.concat([sigPush, pubKeyPush]);

    tx.setInputScript(vin, scriptSig);

    return;
  });

  return cbk(null, {transaction: tx.toHex()});
};

