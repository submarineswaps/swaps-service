const {encode} = require('varuint-bitcoin');
const {OP_PUSHDATA1} = require('bitcoin-ops');

const {ECPair} = require('./../tokenslib');
const {networks} = require('./../tokenslib');
const scriptBuffersAsScript = require('./script_buffers_as_script');
const {Transaction} = require('./../tokenslib');

const {fromHex} = Transaction;
const {fromWIF} = ECPair;
const hexBase = 16;
const {SIGHASH_ALL} = Transaction;

/** Generate input scripts for legacy p2sh transaction inputs

  {
    key: <Signing Key WIF String>
    network: <Network Name String>
    transaction: <Unsigned Transaction Hex String>
    unlock: <HTLC Preimage, Dummy Byte or Public Key Hex String>
    utxos: [{
      redeem: <Redeem Script Hex String>
      tokens: <Outpoint Tokens Value Number>
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
module.exports = ({key, network, transaction, unlock, utxos}) => {
  if (!key) {
    throw new Error('ExpectedSigningKeyForInputScriptGeneration');
  }

  if (!network || !networks[network]) {
    throw new Error('ExpectedNetworkNameForSigningInputScripts');
  }

  if (unlock === undefined) {
    throw new Error('ExpectedUnlockElementForInputScriptSignatures');
  }

  if (!transaction) {
    throw new Error('ExpectedTransactionToSign');
  }

  if (!Array.isArray(utxos)) {
    throw new Error('ExpectedLegacyUtxosForSigning');
  }

  const forkModifier = parseInt(networks[network].fork_id || 0, hexBase);
  const tx = fromHex(transaction);
  const sigHashAll = parseInt(SIGHASH_ALL, hexBase);
  const signingKey = fromWIF(key, networks[network]);

  return utxos.map(({redeem, tokens, vin}) => {
    const redeemScript = Buffer.from(redeem, 'hex');
    const sigHashFlag = sigHashAll | (forkModifier || sigHashAll);

    let sigHash;

    if (!!forkModifier) {
      sigHash = tx.hashForWitnessV0(vin, redeemScript, tokens, sigHashFlag);
    } else {
      sigHash = tx.hashForSignature(vin, redeemScript, sigHashFlag);
    }

    const sig = signingKey.sign(sigHash);

    const signature = Buffer.concat([sig.toDER(), Buffer.from([sigHashFlag])]);

    const inputScriptElements = [
      signature,
      Buffer.from(unlock, 'hex'),
      OP_PUSHDATA1,
      redeemScript,
    ];

    const script = scriptBuffersAsScript(inputScriptElements);

    return {script, vin};
  });
};

