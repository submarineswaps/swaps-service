const bip65Encode = require('bip65').encode;
const bitcoinjsLib = require('bitcoinjs-lib');
const {Transaction} = require('bitcoinjs-lib');

const addressToOutputScript = bitcoinjsLib.address.toOutputScript;
const hashAll = Transaction.SIGHASH_ALL;
const {sha256} = bitcoinjsLib.crypto;
const {testnet} = bitcoinjsLib.networks;
const {witnessScriptHash} = bitcoinjsLib.script;

/** Sweep chain swap output

  {
    current_block_height: <Current Block Height Number>
    destination: <Send Tokens to Address String>
    redeem_script: <Redeem Script Hex>
    preimage: <Payment Preimage Hex String>
    private_key: <Claim Private Key WIF String>
    redeem_script: <Redeem Script Hex Serialized String>
    spend_transaction: <Spend Transaction Serialized Hex String>
    tokens: <Claim Tokens Number>
  }

  @returns via cbk
  {
    transaction: <Sweep Transaction Hex Serialized String>
  }
*/
module.exports = (args, cbk) => {
  const fundingTx = Transaction.fromHex(args.spend_transaction);
  const lockTime = bip65Encode({blocks: args.current_block_height});
  const preimage = Buffer.from(args.preimage, 'hex');
  const redeemScript = Buffer.from(args.redeem_script, 'hex');
  const scriptPub = addressToOutputScript(args.destination, testnet);
  const signingKey = bitcoinjsLib.ECPair.fromWIF(args.private_key, testnet);
  const {tokens} = args;
  const transaction = new Transaction();

  [fundingTx.getHash()].forEach((txId, i) => transaction.addInput(txId, i));

  transaction.addOutput(scriptPub, args.tokens);

  transaction.lockTime = lockTime;

  const prevPub = witnessScriptHash.output.encode(sha256(redeemScript));

  const sigHash = transaction.hashForWitnessV0(0, prevPub, tokens, hashAll);

  const sig = signingKey.sign(sigHash).toScriptSignature(hashAll);

  const witnesses = [[sig, preimage, redeemScript]];

  witnesses.forEach((witness, i) => transaction.setWitness(i, witness));

  return cbk(null, {transaction: transaction.toHex()});
};

