const BN = require('bn.js');
const {crypto} = require('bitcoinjs-lib');
const {OP_0} = require('bitcoin-ops');
const {script} = require('bitcoinjs-lib');
const {Transaction} = require('bitcoinjs-lib');
const varuint = require('varuint-bitcoin')

const bip32Path = require('./bip32_path');
const decodePsbt = require('./decode_psbt');
const encodePsbt = require('./encode_psbt');
const isMultisig = require('./is_multisig');
const pushData = require('./push_data');
const types = require('./types');

const decBase = 10;
const {decompile} = script;
const encodeSig = script.signature.encode;
const endianness = 'le';
const {hash160} = crypto;
const opNumberOffset = 80;
const {sha256} = crypto;
const sighashByteLength = 4;
const stackIndexByteLength = 4;
const tokensByteLength = 8;

/** Update a PSBT

  {
    [additional_attributes]: [{
      type: <Type Hex String>
      value: <Value Hex String>
      vin: <Input Index Number>
      vout: <Output Index Number>
    }]
    [additional_stack_elements]: [{
      [data_push]: <Script Data Push Hex String>
      [op_code]: <Script Op Code Number>
      stack_index: <Witness Stack Index Number>
      vin: <Input Index Number>
    }]
    [bip32_derivations]: [{
      fingerprint: <BIP 32 Fingerprint of Parent's Key Hex String>
      path: <BIP 32 Derivation Path String>
      public_key: <Public Key String>
    }]
    psbt: <BIP 174 Encoded PSBT String>
    [redeem_scripts]: [<Hex Encoded Redeem Script String>]
    [sighashes]: [{
      id: <Transaction Id String>
      sighash: <Sighash Flag Number>
      vout: <Spending Output Index Number>
    }]
    [signatures]: [{
      vin: <Signature Input Index Number>
      hash_type: <Signature Hash Type Number>
      public_key: <BIP 32 Public Key String>
      signature: <Signature Hex String>
    }]
    [transactions]: [<Hex Encoding Transaction String>]
    [witness_scripts]: [<Witness Script String>]
  }

  @throws
  <Update PSBT Error>

  @returns
  {
    psbt: <Hex Encoded Partially Signed Bitcoin Transaction String>
  }
*/
module.exports = args => {
  if (!args.psbt) {
    throw new Error('ExpectedPsbtToUpdate');
  }

  const addAttributes = args.additional_attributes || [];
  const bip32Derivations = args.bip32_derivations || [];
  const decoded = decodePsbt({psbt: args.psbt});
  const inputs = [];
  const outputs = [];
  const pairs = []
  const pubKeyHashes = {};
  const pubKeys = {};
  const redeemScripts = args.redeem_scripts || [];
  const redeems = {};
  const scriptPubs = {};
  const sighashes = {};
  const signatures = {};
  const stackElements = {};
  const transactions = args.transactions || [];
  const txs = {};
  const witnessScripts = args.witness_scripts || [];
  const witnesses = {};

  const tx = Transaction.fromHex(decoded.unsigned_transaction);

  // The unsigned transaction is the top pair
  pairs.push({
    type: Buffer.from(types.global.unsigned_tx, 'hex'),
    value: tx.toBuffer(),
  });

  addAttributes.forEach(({type, value, vin, vout}) => {
    if (vin !== undefined || vout !== undefined) {
      return;
    }

    return pairs.push({
      type: Buffer.from(type, 'hex'),
      value: Buffer.from(value, 'hex'),
    });
  });

  pairs.push({separator: true});

  // Index public keys and public key hashes for lookup
  bip32Derivations.forEach(n => {
    const pkHash = hash160(Buffer.from(n.public_key, 'hex')).toString('hex');

    pubKeyHashes[pkHash] = n;
    pubKeys[n.public_key] = n;

    return;
  });

  // Index additional stack elements by vin
  if (Array.isArray(args.additional_stack_elements)) {
    args.additional_stack_elements.forEach(n => {
      stackElements[n.vin] = stackElements[n.vin] || [];

      return stackElements[n.vin].push(n);
    });
  }

  // Index sighashes by spending outpoint
  if (Array.isArray(args.sighashes)) {
    args.sighashes.forEach(n => sighashes[`${n.id}:${n.vout}`] = n.sighash);
  }

  // Index signatures by vin
  if (Array.isArray(args.signatures)) {
    args.signatures.forEach(n => signatures[n.vin] = signatures[n.vin] || []);
    args.signatures.forEach(n => signatures[n.vin].push(n));
  }

  // Index transactions by id
  transactions.forEach(t => txs[Transaction.fromHex(t).getId()] = t);

  // Index redeem scripts by redeem script hash
  redeemScripts.map(n => Buffer.from(n, 'hex')).forEach(script => {
    const scriptBuffers = decompile(script).filter(Buffer.isBuffer);

    scriptBuffers.map(n => n.toString('hex')).forEach(n => redeems[n] = script);

    const foundKeys = scriptBuffers.map(n => pubKeys[n.toString('hex')]);

    return redeems[hash160(script).toString('hex')] = {
      script,
      bip32_derivations: foundKeys.filter(n => !!n),
    };
  });

  // Index witness scripts by the witness script hash, nested script hash
  witnessScripts.map(n => Buffer.from(n, 'hex')).forEach(script => {
    const witnessHash = sha256(script).toString('hex');

    witnesses[witnessHash] = script;

    const redeemScript = redeems[witnessHash];

    // Exit early when there is no nested p2sh
    if (!redeemScript) {
      return;
    }

    const decompiledBuffers = decompile(script).filter(Buffer.isBuffer);

    const foundKeys = decompiledBuffers.map(n => pubKeys[n.toString('hex')]);

    // Index using the nested scriptPub hash
    witnesses[hash160(redeemScript).toString('hex')] = {
      derivations: foundKeys.filter(n => !!n),
      redeem: redeemScript,
      witness: script,
    };

    return;
  });

  // Iterate through transaction inputs and fill in values
  tx.ins.forEach((input, vin) => {
    const utxo = decoded.inputs[vin] || {};
    const spendsTxId = input.hash.reverse().toString('hex');

    utxo.sighash_type = sighashes[`${spendsTxId}:${input.index}`];

    if (Array.isArray(signatures[vin])) {
      utxo.partial_sig = signatures[vin];
      signatures[vin].forEach(n => utxo.sighash_type = n.hash_type);
    }

    const spends = txs[spendsTxId];

    if (!spends) {
      return inputs.push(null);
    }

    const spendsTx = Transaction.fromHex(spends);

    // Input is a witness spend
    if (spendsTx.hasWitnesses()) {
      // Find the output in the spending transaction that matches the input
      const out = spendsTx.outs
        .map(({script, value}) => {
          // Get the hash being spent, either a P2SH or a P2WSH
          const [, scriptHash] = decompile(script);

          if (!scriptHash) {
            return;
          }

          const hash = scriptHash.toString('hex');

          const matchingWitness = witnesses[hash] || {};

          const {derivations, redeem, witness} = matchingWitness;

          return {derivations, hash, redeem, script, value, witness};
        })
        .find(({hash}) => !!witnesses[hash]);

      utxo.bip32_derivations = out.derivations;
      utxo.redeem_script = out.redeem.toString('hex');
      utxo.witness_script = out.witness.toString('hex');

      utxo.witness_utxo = {
        script_pub: out.script.toString('hex'),
        tokens: out.value,
      };
    } else {
      // Input is a non-witness spend
      const out = spendsTx.outs
        .map(({script}) => {
          const [, hash] = decompile(script);

          const index = hash.toString('hex');

          const redeem = redeems[index] || {};

          return {
            index,
            bip32_derivations: redeem.bip32_derivations,
            redeem: redeem.script,
          };
        })
        .find(({index}) => !!redeems[index]);

      utxo.bip32_derivations = out.bip32_derivations;
      utxo.non_witness_utxo = spends.toString('hex');
      utxo.redeem_script = out.redeem.toString('hex');
    }

    return inputs.push(utxo);
  });

  // Encode inputs into key value pairs
  tx.ins.forEach((txIn, vin) => {
    const n = inputs[vin] || decoded.inputs[vin];

    // Legacy UTXO being spent by this input
    if (!!n.non_witness_utxo) {
      pairs.push({
        type: Buffer.from(types.input.non_witness_utxo, 'hex'),
        value: Buffer.from(n.non_witness_utxo, 'hex'),
      });
    }

    // Witness UTXO being spent by this input
    if (!!n.witness_utxo) {
      const script = Buffer.from(n.witness_utxo.script_pub, 'hex');

      const tokens = new BN(n.witness_utxo.tokens, decBase)
        .toArrayLike(Buffer, endianness, tokensByteLength);

      pairs.push({
        type: Buffer.from(types.input.witness_utxo, 'hex'),
        value: Buffer.concat([tokens, varuint.encode(script.length), script]),
      });
    }

    // Partial signature
    if (!args.is_final && !!n.partial_sig) {
      n.partial_sig.forEach(n => {
        return pairs.push({
          type: Buffer.concat([
            Buffer.from(types.input.partial_sig, 'hex'),
            Buffer.from(n.public_key, 'hex'),
          ]),
          value: Buffer.from(n.signature, 'hex'),
        });
      });
    }

    // Sighash used to sign this input
    if (!args.is_final && !!n.sighash_type) {
      const sighash = new BN(n.sighash_type, decBase);

      pairs.push({
        type: Buffer.from(types.input.sighash_type, 'hex'),
        value: sighash.toArrayLike(Buffer, endianness, sighashByteLength),
      });
    }

    // Redeem script used in the scriptsig of this input
    if (!args.is_final && !!n.redeem_script) {
      pairs.push({
        type: Buffer.from(types.input.redeem_script, 'hex'),
        value: Buffer.from(n.redeem_script, 'hex'),
      });
    }

    // Witness script used in this input
    if (!args.is_final && !!n.witness_script) {
      pairs.push({
        type: Buffer.from(types.input.witness_script, 'hex'),
        value: Buffer.from(n.witness_script, 'hex'),
      });
    }

    // Bip 32 derivations for this input
    if (!args.is_final && !!n.bip32_derivations) {
      // Sort in-place the derivations by pubkey ascending
      n.bip32_derivations.sort((a, b) => a.public_key < b.public_key ? -1 : 1);

      n.bip32_derivations.forEach(n => {
        pairs.push({
          type: Buffer.concat([
            Buffer.from(types.input.bip32_derivation, 'hex'),
            Buffer.from(n.public_key, 'hex'),
          ]),
          value: Buffer.concat([
            Buffer.from(n.fingerprint, 'hex'),
            bip32Path({path: n.path}),
          ]),
        });
      });
    }

    if (!!args.is_final && !n.partial_sig.length) {
      throw new Error('ExpectedSignaturesForFinalizedTransaction');
    }

    if (!!args.is_final && !n.redeem_script && !n.witness_script) {
      throw new Error('ExpectedSpendScriptForFinalizedTransaction');
    }

    // Final scriptsig for this input
    if (!!args.is_final && !!n.partial_sig.length) {
      const [signature] = n.partial_sig;

      const sigs = n.partial_sig.map(n => {
        const sig = encodeSig(Buffer.from(n.signature, 'hex'), n.hash_type);

        return Buffer.concat([varuint.encode(sig.length), sig]);
      });

      // Non-witness Multi-sig?
      if (isMultisig({script: n.redeem_script})) {
        const nullDummy = new BN(OP_0, decBase).toArrayLike(Buffer);
        const redeemScript = Buffer.from(n.redeem_script, 'hex');

        const redeemScriptPush = pushData({data: redeemScript});
        const [sigsRequired] = decompile(redeemScript);

        const requiredSignatureCount = sigsRequired - opNumberOffset;

        if (sigs.length !== requiredSignatureCount) {
          throw new Error('ExpectedAdditionalSignatures');
        }

        const components = [nullDummy].concat(sigs).concat([redeemScriptPush]);

        pairs.push({
          type: Buffer.from(types.input.final_scriptsig, 'hex'),
          value: Buffer.concat(components),
        });
      }

      // Witness P2SH Nested?
      if (!!n.witness_utxo && !!n.redeem_script) {
        pairs.push({
          type: Buffer.from(types.input.final_scriptsig, 'hex'),
          value: pushData({encode: n.redeem_script}),
        });
      }

      // Witness Multi-sig?
      if (isMultisig({script: n.witness_script})) {
        const nullDummy = new BN(OP_0, decBase).toArrayLike(Buffer);
        const witnessScript = Buffer.from(n.witness_script, 'hex');

        const [sigsRequired] = decompile(witnessScript);
        const witnessScriptPush = pushData({data: witnessScript});

        const requiredSignatureCount = sigsRequired - opNumberOffset;

        if (sigs.length !== requiredSignatureCount) {
          throw new Error('ExpectedAdditionalSignatures');
        }

        const components = [nullDummy].concat(sigs).concat(witnessScriptPush);

        const values = Buffer.concat(components);

        pairs.push({
          type: Buffer.from(types.input.final_scriptwitness, 'hex'),
          value: Buffer.concat([varuint.encode(components.length), values]),
        });
      }

      // Witness but non-multisig
      if (!!n.witness_script && !isMultisig({script: n.witness_script})) {
        const witnessScriptPush = pushData({encode: n.witness_script});

        const components = [].concat(sigs).concat(witnessScriptPush);

        if (Array.isArray(n.add_stack_elements)) {
          n.add_stack_elements.sort((a, b) => (a.index < b.index ? -1 : 1));

          n.add_stack_elements.forEach(({index, value}) => {
            const pushValue = Buffer.from(value, 'hex');

            const pushDataValue = Buffer.concat([
              varuint.encode(pushValue.length),
              pushValue,
            ]);

            return components.splice(index, 0, pushDataValue);
          });
        }

        const value = Buffer.concat([
          varuint.encode(components.length),
          Buffer.concat(components),
        ]);

        pairs.push({
          value,
          type: Buffer.from(types.input.final_scriptwitness, 'hex'),
        });
      }
    }

    // Additional stack elements
    if (!args.is_final && Array.isArray(stackElements[vin])) {
      stackElements[vin].forEach(n => {
        const stackIndex = new BN(n.stack_index, decBase);
        let value;

        if (n.data_push !== undefined) {
          value = Buffer.from(n.data_push, 'hex');
        } else if (n.op_code !== undefined) {
          value = new BN(n.op_code, decBase).toArrayLike(Buffer);
        } else {
          throw new Error('UnknownStackElementType');
        }

        return pairs.push({
          type: Buffer.concat([
            Buffer.from(types.input.additional_stack_element, 'hex'),
            stackIndex.toArrayLike(Buffer, endianness, stackIndexByteLength),
          ]),
          value: Buffer.concat([varuint.encode(value.length), value]),
        });
      });
    }

    addAttributes.filter(n => n.vin === vin).forEach(({type, value}) => {
      return pairs.push({
        type: Buffer.from(type, 'hex'),
        value: Buffer.from(value, 'hex'),
      });
    });

    return pairs.push({separator: true});
  });

  // Iterate through outputs to update output data
  tx.outs.forEach(({script}) => {
    const out = {};

    const [foundKey] = decompile(script)
      .filter(Buffer.isBuffer)
      .map(n => pubKeyHashes[n.toString('hex')])
      .filter(n => !!n);

    if (!!foundKey) {
      out.bip32_derivation = foundKey;
    }

    return outputs.push(!Object.keys(out).length ? null : out);
  });

  // Iterate through outputs to add pairs as appropriate
  tx.outs.forEach((out, vout) => {
    const output = outputs[vout] || decoded.outputs[vout] || {};

    if (!!output.bip32_derivation) {
      pairs.push({
        type: Buffer.concat([
          Buffer.from(types.output.bip32_derivation, 'hex'),
          Buffer.from(output.bip32_derivation.public_key, 'hex'),
        ]),
        value: Buffer.concat([
          Buffer.from(output.bip32_derivation.fingerprint, 'hex'),
          bip32Path({path: output.bip32_derivation.path}),
        ]),
      });
    }

    addAttributes.filter(n => n.vout === vout).forEach(({type, value}) => {
      return pairs.push({
        type: Buffer.from(type, 'hex'),
        value: Buffer.from(value, 'hex'),
      });
    });

    return pairs.push({separator: true});
  });

  return encodePsbt({pairs});
};

