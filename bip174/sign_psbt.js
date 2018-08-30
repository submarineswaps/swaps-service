const {crypto} = require('bitcoinjs-lib');
const {ECPair} = require('bitcoinjs-lib');
const {networks} = require('bitcoinjs-lib');
const {script} = require('bitcoinjs-lib');
const {Transaction} = require('bitcoinjs-lib');

const decodePsbt = require('./decode_psbt');
const updatePsbt = require('./update_psbt');

const {decompile} = script;
const encodeSig = script.signature.encode;
const {hash160} = crypto;

/** Update a PSBT with signatures

  {
    additional_stack_elements: [{
      [data_push]: <Script Data Push Hex String>
      [op_code]: <Script Op Code Number>
      stack_index: <Witness Stack Index Number>
      vin: <Input Index Number>
    }]
    network: <Network Name String>
    psbt: <BIP 174 Encoded PSBT Hex String>
    signing_keys: [<WIF Encoded Private Key String>]
  }

  @throws
  <Sign PSBT Error>

  @returns
  {
    psbt: <BIP 174 Encoded PSBT Hex String>
  }
*/
module.exports = args => {
  let decoded;
  const keys = {};
  const network = networks[args.network];
  const pkHashes = {};

  args.signing_keys.map(k => {
    const key = ECPair.fromWIF(k, network);

    keys[key.publicKey.toString('hex')] = key;
    pkHashes[hash160(key.publicKey).toString('hex')] = key;

    return;
  });

  try {
    decoded = decodePsbt({psbt: args.psbt});
  } catch (err) {
    throw err;
  }

  const tx = Transaction.fromHex(decoded.unsigned_transaction);
  const signatures = [];

  decoded.inputs.forEach((input, vin) => {
    if (!input.bip32_derivations) {
      const scripts = [input.redeem_script, input.witness_script];

      scripts.filter(n => !!n).map(n => Buffer.from(n, 'hex')).forEach(n => {
        const buffers = decompile(n).filter(Buffer.isBuffer);

        const keysToSign = buffers.map(b => b.toString('hex')).map(k => {
          return keys[k] || pkHashes[k];
        });

        keysToSign.filter(n => !!n).forEach(signingKey => {
          let hashToSign;
          const sighashType = input.sighash_type;

          if (!!input.witness_script && !!input.witness_utxo) {
            const script = Buffer.from(input.witness_script, 'hex');
            const tokens = input.witness_utxo.tokens;

            hashToSign = tx.hashForWitnessV0(vin, script, tokens, sighashType);
          }

          if (!!input.non_witness_utxo && !!input.redeem_script) {
            const redeemScript = Buffer.from(input.redeem_script, 'hex');

            hashToSign = tx.hashForSignature(vin, redeemScript, sighashType);
          }

          if (!hashToSign) {
            return;
          }

          const signature = encodeSig(signingKey.sign(hashToSign), sighashType);

          return signatures.push({
            vin,
            hash_type: sighashType,
            public_key: signingKey.publicKey.toString('hex'),
            signature: signature.toString('hex'),
          });
        });
      });
    }

    (input.bip32_derivations || []).forEach(bip32 => {
      const signingKey = keys[bip32.public_key];

      if (!signingKey) {
        return;
      }

      let hashToSign;
      const sighashType = input.sighash_type;

      if (!!input.witness_script && !!input.witness_utxo) {
        const script = Buffer.from(input.witness_script, 'hex');
        const tokens = input.witness_utxo.tokens;

        hashToSign = tx.hashForWitnessV0(vin, script, tokens, sighashType);
      }

      if (!!input.non_witness_utxo && !!input.redeem_script) {
        const redeemScript = Buffer.from(input.redeem_script, 'hex');

        hashToSign = tx.hashForSignature(vin, redeemScript, sighashType);
      }

      if (!hashToSign) {
        return;
      }

      const signature = encodeSig(signingKey.sign(hashToSign), sighashType);

      return signatures.push({
        vin,
        hash_type: sighashType,
        public_key: bip32.public_key,
        signature: signature.toString('hex'),
      });
    });
  });

  return updatePsbt({
    signatures,
    additional_stack_elements: args.additional_stack_elements,
    psbt: args.psbt, signatures,
  });
};

