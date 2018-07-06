const {encode} = require('varuint-bitcoin');
const {OP_PUSHDATA1} = require('bitcoin-ops');

const {ECPair} = require('./../tokenslib');
const {networks} = require('./../tokenslib');
const scriptBuffersAsScript = require('./script_buffers_as_script');
const {Transaction} = require('./../tokenslib');

const {fromHex} = Transaction;
const {fromWIF} = ECPair;
const {SIGHASH_ALL} = Transaction;

/** Generate input scripts for legacy p2sh claim transaction inputs

  {
    key: <Signing Key WIF String>
    network: <Network Name String>
    preimage: <HTLC Preimage Hex String>
    transaction: <Unsigned Transaction Hex String>
    utxos: [{
      redeem: <Redeem Script Hex String>
      vin: <Input Index Number>
    }]
  }

  @throws Error on invalid arguments

  @returns
  [{
    script: <Input Signature Script Hex String>
    vin: <Input Index Number>
  }]
*/
module.exports = ({key, network, preimage, transaction, utxos}) => {
  if (!key) {
    throw new Error('ExpectedSigningKeyForInputScriptGeneration');
  }

  if (!network || !networks[network]) {
    throw new Error('ExpectedNetworkNameForSigningInputScripts');
  }

  if (!preimage) {
    throw new Error('ExpectedHashLockPreimageForInputScriptSignatures');
  }

  if (!transaction) {
    throw new Error('ExpectedTransactionToSign');
  }

  if (!Array.isArray(utxos)) {
    throw new Error('ExpectedLegacyUtxosForSigning');
  }

  const tx = fromHex(transaction);
  const signingKey = fromWIF(key, networks[network]);

  return utxos.map(({redeem, vin}) => {
    const redeemScript = Buffer.from(redeem, 'hex');

    const sigHash = tx.hashForSignature(vin, redeemScript, SIGHASH_ALL);

    const inputScriptElements = [
      signingKey.sign(sigHash).toScriptSignature(SIGHASH_ALL),
      Buffer.from(preimage, 'hex'),
      OP_PUSHDATA1,
      redeemScript
    ];

    const script = scriptBuffersAsScript(inputScriptElements);

    return {script, vin};
  });
};

