const bip65Encode = require('bip65').encode;
const bitcoinjsLib = require('bitcoinjs-lib');
const {Transaction} = require('bitcoinjs-lib');

const addressToOutputScript = bitcoinjsLib.address.toOutputScript;
const hashAll = Transaction.SIGHASH_ALL;
const {testnet} = bitcoinjsLib.networks;
const {sha256} = bitcoinjsLib.crypto;
const {witnessScriptHash} = bitcoinjsLib.script;

/** Sweep chain swap output

  {
    current_block_height: <Current Block Height Number>
    destination: <Send Tokens to Address String>
    redeem_script: <Redeem Script Hex>
    preimage: <Payment Preimage Hex String>
    private_key: <Claim Private Key WIF String>
    redeem_script: <Redeem Script Hex Serialized String>
    utxos: [{
      tokens: <Tokens Number>
      transaction_id: <Transaction Id String>
      vout: <Vout Number>
    }]
  }

  @returns via cbk
  {
    transaction: <Sweep Transaction Hex Serialized String>
  }
*/
module.exports = (args, cbk) => {
  if (!args.utxos.length) {
    return cbk([0, 'Expected funding tx utxos']);
  }

  const lockTime = bip65Encode({blocks: args.current_block_height});
  const preimage = Buffer.from(args.preimage, 'hex');
  const redeemScript = Buffer.from(args.redeem_script, 'hex');
  const scriptPub = addressToOutputScript(args.destination, testnet);
  const signingKey = bitcoinjsLib.ECPair.fromWIF(args.private_key, testnet);
  const tokens = args.utxos.reduce((sum, n) => n.tokens + sum, 0) - 20000;
  const transaction = new Transaction();

  args.utxos.forEach(n => {
    return transaction.addInput(Buffer.from(n.transaction_id, 'hex').reverse(), n.vout);
  });

  transaction.addOutput(scriptPub, tokens);

  transaction.lockTime = lockTime;

  const prevPub = witnessScriptHash.output.encode(sha256(redeemScript));

  args.utxos.forEach((n, i) => {
    const sigHash = transaction.hashForWitnessV0(i, redeemScript, n.tokens, hashAll);

    const sig = signingKey.sign(sigHash);

    const signature = sig.toScriptSignature(hashAll);

    const witnesses = [[
      signature,
      preimage,
      redeemScript,
    ]];

    witnesses.forEach((witness, i) => transaction.setWitness(i, witness));

    return;
  });

  return cbk(null, {transaction: transaction.toHex()});
};

