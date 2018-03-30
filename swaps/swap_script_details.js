const {address} = require('bitcoinjs-lib');
const {crypto} = require('bitcoinjs-lib');
const {networks} = require('bitcoinjs-lib');
const {script} = require('bitcoinjs-lib');

const {hash160} = crypto;
const {scriptHash} = script;
const {sha256} = crypto;
const {testnet} = networks;
const {toASM} = script;
const {witnessScriptHash} = script;

const encodeScriptHash = scriptHash.output.encode;

/** Given a pkhash swap script, its details.

  {
    redeem_script: <Redeem Script Hex String>
  }

  @throws
  <Error> on derive issue

  @returns
  {
    destination_public_key: <Destination Public Key Hex String>
    p2sh_output_script: <P2SH Nested Output Script Hex String>
    p2sh_p2wsh_address: <Nested Pay to Witness Script Address String>
    p2wsh_address: <Pay to Witness Script Hash Address String>
    payment_hash: <Payment Hash Hex String>
    refund_p2wpkh_address: <Refund P2WPKH Address String>
    refund_public_key_hash: <Refund Public Key Hash String>
    timelock_block_height: <Locked Until Height Number>
    witness_output_script: <Witness Output Script Hex String>
  }
*/
module.exports = args => {
  if (!args.redeem_script) {
    throw new Error('ExpectedRedeemScript');
  }

  const redeemScript = Buffer.from(args.redeem_script, 'hex');

  const scriptAssembly = toASM(script.decompile(redeemScript)).split(' ');

  const [
    OP_DUP,
    OP_SHA256, paymentHash, OP_EQUAL,
    OP_IF,
      OP_DROP,
      destinationPublicKey,
    OP_ELSE,
      cltv, OP_CHECKLOCKTIMEVERIFY, OP_DROP2,
      OP_DUP2, OP_HASH160, refundPublicKeyHash, OP_EQUALVERIFY,
    OP_ENDIF,
    OP_CHECKSIG,
  ] = scriptAssembly;

  if (OP_DUP !== 'OP_DUP') {
    throw new Error('ExpectedInitialOpDup');
  }

  if (OP_SHA256 !== 'OP_SHA256') {
    throw new Error('ExpectedSha256');
  }

  if (!paymentHash || paymentHash.length !== 32 * 2) {
    throw new Error('ExpectedStandardPaymentHash');
  }

  if (OP_EQUAL !== 'OP_EQUAL') {
    throw new Error('ExpectedOpEqual');
  }

  if (OP_IF !== 'OP_IF') {
    throw new Error('ExpectedOpIf');
  }

  if (OP_DROP !== 'OP_DROP') {
    throw new Error('ExpectedOpDrop');
  }

  if (!destinationPublicKey || destinationPublicKey.length !== 66) {
    throw new Error('ExpectedDestinationKey');
  }

  if (OP_ELSE !== 'OP_ELSE') {
    throw new Error('ExpectedOpElse');
  }

  if (!cltv) {
    throw new Error('ExpectedCltv');
  }

  if (OP_CHECKLOCKTIMEVERIFY !== 'OP_CHECKLOCKTIMEVERIFY') {
    throw new Error('ExpectedOpCltv');
  }

  if (OP_DROP2 !== 'OP_DROP') {
    throw new Error('ExpectedOpDrop');
  }

  if (OP_DUP2 !== 'OP_DUP') {
    throw new Error('ExpectedOpDup');
  }

  if (OP_HASH160 !== 'OP_HASH160') {
    throw new Error('ExpectedOpHash160');
  }

  if (!refundPublicKeyHash || refundPublicKeyHash.length !== 20 * 2) {
    throw new Error('ExpectedRefundPublicKeyHash');
  }

  if (OP_EQUALVERIFY !== 'OP_EQUALVERIFY') {
    throw new Error('ExpectedOpEqualVerify');
  }

  if (OP_ENDIF !== 'OP_ENDIF') {
    throw new Error('ExpectedOpEndIf');
  }

  if (OP_CHECKSIG !== 'OP_CHECKSIG') {
    throw new Error('ExpectedCheckSig');
  }

  const witnessProgram = witnessScriptHash.output.encode(sha256(redeemScript));

  const p2shWrappedWitnessProg = encodeScriptHash(hash160(witnessProgram));

  const p2shAddr = address.fromOutputScript(p2shWrappedWitnessProg, testnet);

  const refundHash = Buffer.from(refundPublicKeyHash, 'hex');

  const scriptPub = script.witnessPubKeyHash.output.encode(refundHash);
  const refundP2wpkhAddress = address.fromOutputScript(scriptPub, testnet);

  const lockHeight = Buffer.from(cltv, 'hex').readUIntLE(0, cltv.length / 2);

  return {
    destination_public_key: destinationPublicKey,
    p2sh_output_script: p2shWrappedWitnessProg.toString('hex'),
    p2sh_p2wsh_address: p2shAddr,
    p2wsh_address: address.fromOutputScript(witnessProgram, testnet),
    payment_hash: paymentHash,
    refund_p2wpkh_address: refundP2wpkhAddress,
    refund_public_key_hash: refundPublicKeyHash,
    timelock_block_height: lockHeight,
    witness_output_script: witnessProgram.toString('hex'),
  };
};

