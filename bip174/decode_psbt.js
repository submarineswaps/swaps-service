const BN = require('bn.js');
const {crypto} = require('bitcoinjs-lib');
const {ECPair} = require('bitcoinjs-lib');
const {script} = require('bitcoinjs-lib');
const {Transaction} = require('bitcoinjs-lib');
const varuint = require('varuint-bitcoin')

const checkNonWitnessUtxo = require('./check_non_witness_utxo');
const checkWitnessUtxo = require('./check_witness_utxo');
const decodeSignature = require('./decode_signature');
const types = require('./types');

const {decompile} = script;
const fingerPrintByteLength = 4;
const keyCodeByteLength = 1;
const magicBytes = Buffer.from(types.global.magic);
const {ripemd160} = crypto;
const globalSeparatorCode = parseInt(types.global.separator, 16);
const tokensByteLength = 8;

/** Decode a BIP 174 encoded PSBT

  {
    psbt: <Hex Encoded Partially Signed Bitcoin Transaction String>
  }

  @throws
  <Invalid PSBT Error>

  @returns
  {
    inputs: [{
       bip32_derivations: [{
        fingerprint: <Public Key Fingerprint Hex String>
        path: <BIP 32 Derivation Path Hex String>
        public_key: <Public Key Hex String>
      }]
      final_scriptsig: <Final ScriptSig Hex String>
      final_scriptwitness: <Final Script Witness Hex String>
      non_witness_utxo: <Non-Witness Hex Encoded Transaction String>
      partial_sig: {
        hash_type: <Signature Hash Type Number>
        public_key: <Public Key Hex String>
        signature: <Signature Hex String>
      }
      redeem_script: <Hex Encoded Redeem Script String>
      sighash_type: <Sighash Type Number>
      witness_script: <Witness Script Hex String>
      witness_utxo: {
        script_pub: <UTXO ScriptPub Hex String>
        tokens: <Tokens Number>
      }
    }]
  }
*/
module.exports = ({psbt}) => {
  if (!psbt) {
    throw new Error('ExpectedHexSerializedPartiallySignedBitcoinTransaction');
  }

  const buffer = Buffer.from(psbt, 'hex');
  const decoded = {inputs: [], outputs: [], pairs: []};
  const foundInputs = [];
  const foundOutputs = [];
  let input;
  let inputKeys = {};
  let offset = 0;
  let output;
  let outputKeys = {};
  let terminatorsExpected;
  let terminatorsFound = 0;

  // Buffer read methods
  const read = bytesCount => {
    offset += bytesCount;

    return buffer.slice(offset - bytesCount, offset);
  };
  const readCompactVarInt = () => {
    const n = varuint.decode(buffer, offset);

    offset += varuint.decode.bytes;

    return n;
  };

  // Start reading - beginning with magic bytes
  const magicValue = read(magicBytes.length);

  if (!magicValue.equals(magicBytes)) {
    throw new Error('UnrecognizedMagicBytes');
  }

  const globalSeparator = buffer.readUInt8(offset++);

  if (globalSeparator !== globalSeparatorCode) {
    throw new Error('ExpectedGlobalSeparator');
  }

  // Read through key/value pairs
  while (offset < buffer.length) {
    // KeyType bytes are variable length
    const keyTypeLength = readCompactVarInt();

    // An unsigned transaction must come first
    if (!keyTypeLength && !decoded.unsigned_transaction) {
      throw new Error('ExpectedUnsignedTransaction');
    }

    // End markers are zero
    if (!keyTypeLength) {
      terminatorsFound++;

      // Check non-witness UTXO input redeem scripts
      if (!!input && !!input.non_witness_utxo && !!input.redeem_script) {
        try {
          checkNonWitnessUtxo({
            hash: input.redeem_script_hash,
            script: Buffer.from(input.redeem_script, 'hex'),
            utxo: Buffer.from(input.non_witness_utxo, 'hex'),
          });
        } catch (err) {
          throw err;
        }
      }

      // Check witness UTXO
      if (!!input && !!input.witness_utxo) {
        try {
          checkWitnessUtxo({
            hash: input.witness_script_hash,
            redeem: !input.redeem_script ? null : Buffer.from(input.redeem_script, 'hex'),
            script: Buffer.from(input.witness_utxo.script_pub, 'hex'),
          });
        } catch (err) {
          throw err;
        }
      }

      // A valid input was fully parsed
      if (!!input) {
        delete input.redeem_script_hash;
        delete input.witness_script_hash;

        decoded.inputs.push(input);

        input = null;
        inputKeys = {};
      }

      // Output detected and finished loading its values
      if (!!output) {
        decoded.outputs.push(output);

        output = null;
        outputKeys = {};
      }

      continue;
    }

    // Keys are variable length data
    const keyType = read(keyTypeLength);

    // The key code defines what "type" a key/pair is
    const keyCode = keyType.slice(0, keyCodeByteLength);

    const keyTypeCode = keyCode.toString('hex');

    // Values are variable length data
    const value = read(readCompactVarInt());

    if (!decoded.unsigned_transaction) {
      switch (keyType.toString('hex')) {
      case types.global.unsigned_tx:
        const tx = Transaction.fromHex(value);
        decoded.unsigned_transaction = value.toString('hex');

        terminatorsExpected = tx.ins.length + tx.outs.length + [tx].length;

        tx.ins.forEach(n => {
          if (!!n.script.length) {
            throw new Error('ExpectedEmptyScriptSigs')
          }

          foundInputs.push(n);
        });

        tx.outs.forEach(n => foundOutputs.push(n));
        break;

      default:
        throw new Error('InvalidGlobalTransactionKeyType');
        break;
      }
    } else if (!!foundInputs.length || !!input) {
      // Start of a new input?
      if (!input) {
        foundInputs.pop();
        input = {};
      }

      if (!!inputKeys[keyType.toString('hex')]) {
        throw new Error('UnexpectedDuplicateInputKey');
      }

      // Keep track of input keys to make sure there's no duplicates
      inputKeys[keyType.toString('hex')] = true;

      switch (keyTypeCode) {
      case types.input.bip32_derivation:
        input.bip32_derivations = input.bip32_derivations || [];

        let key;

        // Derive the public key from the public key bytes
        try {
          key = ECPair.fromPublicKey(keyType.slice([keyTypeCode].length));
        } catch (err) {
          throw new Error('InvalidBip32Key');
        }

        input.bip32_derivations.push({
          fingerprint: value.slice(0, fingerPrintByteLength).toString('hex'),
          path: value.slice(fingerPrintByteLength).toString('hex'),
          public_key: key.publicKey.toString('hex'),
        });
        break;

      case types.input.final_scriptsig:
        if (keyType.length > keyCodeByteLength) {
          throw new Error('InvalidFinalScriptSigKey');
        }

        // Check to make sure that the scriptsig is a reasonable script
        if (!decompile(value)) {
          throw new Error('InvalidFinalScriptSig');
        }

        input.final_scriptsig = value.toString('hex');
        break;

      case types.input.final_scriptwitness:
        if (keyType.length > keyCodeByteLength) {
          throw new Error('InvalidScriptWitnessTypeKey');
        }

        const byteLength = varuint.decode(value);

        const scriptWitness = value.slice(varuint.decode.bytes);

        // Check to make sure that the final script witness is valid script
        if (!decompile(scriptWitness)) {
          throw new Error('InvalidScriptWitness');
        }

        input.final_scriptwitness = scriptWitness.toString('hex');
        break;

      case types.input.non_witness_utxo:
        if (keyType.length > keyCodeByteLength) {
          throw new Error('InvalidNonWitnessUtxoTypeKey');
        }

        try {
          Transaction.fromBuffer(value);
        } catch (err) {
          throw new Error('ExpectedValidTransactionForNonWitnessUtxo');
        }

        input.non_witness_utxo = value.toString('hex');
        break;

      case types.input.partial_sig:
        let sigPubKey;
        const signature = decodeSignature({signature: value});

        // Make sure the partial signature public key is a valid pubkey
        try {
          sigPubKey = ECPair.fromPublicKey(keyType.slice(keyCodeByteLength));
        } catch (err) {
          throw new Error('InvalidPublicKeyForPartialSig');
        }

        input.partial_sig = {
          hash_type: signature.hash_type,
          public_key: sigPubKey.publicKey.toString('hex'),
          signature: signature.signature.toString('hex'),
        };
        break;

      case types.input.redeem_script:
        if (keyType.length > keyCodeByteLength) {
          throw new Error('InvalidRedeemScriptTypeKey');
        }

        // Make sure the redeem script is a reasonable script
        if (!decompile(value)) {
          throw new Error('InvalidRedeemScript');
        }

        input.redeem_script = value.toString('hex');
        input.redeem_script_hash = ripemd160(crypto.sha256(value));
        break;

      case types.input.sighash_type:
        if (keyType.length > keyCodeByteLength) {
          throw new Error('InvalidSigHashTypeKey');
        }

        input.sighash_type = value.readUInt32LE();
        break;

      case types.input.witness_script:
        if (keyType.length > keyCodeByteLength) {
          throw new Error('InvalidWitnessScriptTypeKey');
        }

        // Make sure that the witness script is a reasonable script
        if (!decompile(value)) {
          throw new Error('InvalidWitnessScript');
        }

        input.witness_script = value.toString('hex');
        input.witness_script_hash = crypto.sha256(value);
        break;

      case types.input.witness_utxo:
        if (keyType.length > keyCodeByteLength) {
          throw new Error('InvalidInputWitnessUtxoTypeKey');
        }

        const scriptPubKeyLen = varuint.decode(value.slice(tokensByteLength));

        const scriptPub = value.slice(tokensByteLength + varuint.decode.bytes);

        input.witness_utxo = {
          script_pub: scriptPub.toString('hex'),
          tokens: new BN(value.slice(0, tokensByteLength), 'le').toNumber(),
        };
        break;

      default:
        break;
      }
    } else if (!!foundOutputs.length || !!output) {
      if (!output) {
        foundOutputs.pop();
        output = {};
      }

      if (!!outputKeys[keyType.toString('hex')]) {
        throw new Error('UnexpectedDuplicateInputKey');
      }

      // Keep track of the output key to guard against duplicates
      outputKeys[keyType.toString('hex')] = true;

      switch (keyTypeCode) {
      case types.output.bip32_derivation:
        output.bip32_derivations = output.bip32_derivations || [];

        let bip32Key;
        const publicKey = keyType.slice([keyTypeCode].length);

        // Make sure the output bip32 public key is valid
        try {
          bip32Key = ECPair.fromPublicKey(publicKey);
        } catch (err) {
          throw new Error('InvalidOutputBip32PublicKey');
        }

        output.bip32_derivations.push({
          fingerprint: value.slice(0, fingerPrintByteLength).toString('hex'),
          path: value.slice(fingerPrintByteLength).toString('hex'),
          public_key: bip32Key.publicKey.toString('hex'),
        });
        break;

      case types.output.redeem_script:
        if (keyType.length > keyCodeByteLength) {
          throw new Error('InvalidOutputRedeemScriptTypeKey');
        }

        // Make sure that the redeem script is a reasonable script
        if (!decompile(value)) {
          throw new Error('InvalidOutputRedeemScript');
        }

        output.redeem_script = value.toString('hex');
        break;

      case types.output.witness_script:
        if (keyType.length > keyCodeByteLength) {
          throw new Error('InvalidOutputWitnessScriptTypeKey');
        }

        // Make sure that the witness script is a reasonable script
        if (!decompile(value)) {
          throw new Error('InvalidOutputWitnessScript');
        }

        output.witness_script = value.toString('hex');
        break;

      default:
        break;
      }
    }

    decoded.pairs.push({
      type: keyType.toString('hex'),
      value: value.toString('hex'),
    });
  }

  if (terminatorsExpected !== terminatorsFound) {
    throw new Error('ExpectedAdditionalOutputs');
  }

  return decoded;
};

