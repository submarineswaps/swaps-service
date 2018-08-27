const BN = require('bn.js');
const {crypto} = require('bitcoinjs-lib');
const {script} = require('bitcoinjs-lib');
const {Transaction} = require('bitcoinjs-lib');
const varuint = require('varuint-bitcoin')

const bip32Path = require('./bip32_path');
const decodePsbt = require('./decode_psbt');
const encodePsbt = require('./encode_psbt');
const types = require('./types');

const decBase = 10;
const {decompile} = script;
const endianness = 'le';
const {hash160} = crypto;
const {sha256} = crypto;
const sighashByteLength = 4;
const tokensByteLength = 8;

/** Update a PSBT

  {
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
    [transactions]: [<Hex Encoding Transaction String>]
    [witness_scripts]: [<Witness Script String>]
  }

  @throws
  <Update PSBT Error>
*/
module.exports = args => {
  if (!args.psbt) {
    throw new Error('ExpectedPsbtToUpdate');
  }

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

  // Index public keys and public key hashes for lookup
  bip32Derivations.forEach(n => {
    const pkHash = hash160(Buffer.from(n.public_key, 'hex')).toString('hex');

    pubKeyHashes[pkHash] = n;
    pubKeys[n.public_key] = n;

    return;
  });

  // Index sighashes by spending outpoint
  if (Array.isArray(args.sighashes)) {
    args.sighashes.forEach(n => sighashes[`${n.id}:${n.vout}`] = n.sighash);
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

    witnesses[hash160(redeemScript).toString('hex')] = {
      derivations: foundKeys.filter(n => !!n),
      redeem: redeemScript,
      witness: script,
    };

    return;
  });

  // Iterate through transaction inputs and fill in values
  tx.ins.forEach((input, vout) => {
    const utxo = decoded.inputs[vout] || {};
    const spendsTxId = input.hash.reverse().toString('hex');

    utxo.sighash_type = sighashes[`${spendsTxId}:${vout}`];

    const spends = txs[spendsTxId];

    if (!spends) {
      return;
    }

    const spendsTx = Transaction.fromHex(spends);

    // Input is a witness spend
    if (spendsTx.hasWitnesses()) {
      const out = spendsTx.outs
        .map(({script, value}) => {
          // Get the hash being spent, either a P2SH or a P2WPKH or a P2WSH
          const [, hash] = decompile(script);

          const index = hash.toString('hex');

          const matchingWitness = witnesses[index] || {};

          const {derivations, redeem, witness} = matchingWitness;

          return {derivations, index, redeem, script, value, witness};
        })
        .find(({index}) => !!witnesses[index]);

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
  decoded.inputs.concat(inputs).forEach(n => {
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

    // Sighash used to sign this input
    if (!!n.sighash_type) {
      const sighash = new BN(n.sighash_type, decBase);

      pairs.push({
        type: Buffer.from(types.input.sighash_type, 'hex'),
        value: sighash.toArrayLike(Buffer, endianness, sighashByteLength),
      });
    }

    // Redeem script used in the scriptsig of this input
    if (!!n.redeem_script) {
      pairs.push({
        type: Buffer.from(types.input.redeem_script, 'hex'),
        value: Buffer.from(n.redeem_script, 'hex'),
      });
    }

    // Witness script used in this input
    if (!!n.witness_script) {
      pairs.push({
        type: Buffer.from(types.input.witness_script, 'hex'),
        value: Buffer.from(n.witness_script, 'hex'),
      });
    }

    // Bip 32 derivations for this input
    if (!!n.bip32_derivations) {
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
  });

  // Iterate through outputs to update output data
  tx.outs.forEach(({script}) => {
    const foundKeys = decompile(script)
      .filter(Buffer.isBuffer)
      .map(n => pubKeyHashes[n.toString('hex')])
      .filter(n => !!n);

    outputs.push({bip32_derivations: foundKeys});
  });

  // Iterate through outputs to add pairs as appropriate
  decoded.outputs.concat(outputs).forEach(n => {
    if (!!n.bip32_derivations) {
      n.bip32_derivations.forEach(n => {
        pairs.push({
          type: Buffer.concat([
            Buffer.from(types.output.bip32_derivation, 'hex'),
            Buffer.from(n.public_key, 'hex'),
          ]),
          value: Buffer.concat([
            Buffer.from(n.fingerprint, 'hex'),
            bip32Path({path: n.path}),
          ]),
        });
      });
    }
  });

  return encodePsbt({pairs});
};

