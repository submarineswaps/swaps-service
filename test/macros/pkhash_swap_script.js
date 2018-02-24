const bip65Encode = require('bip65').encode;
const {OP_CHECKLOCKTIMEVERIFY, OP_CHECKSIG, OP_DROP} = require('bitcoin-ops');
const {OP_DUP, OP_ELSE, OP_ENDIF, OP_EQUAL} = require('bitcoin-ops');
const {OP_EQUALVERIFY, OP_HASH160, OP_IF, OP_SHA256} = require('bitcoin-ops');
const pushdataEncode = require('pushdata-bitcoin').encode;
const pushdataEncodingLen = require('pushdata-bitcoin').encodingLength;
const {script} = require('bitcoinjs-lib');

const scriptBuffersAsScript = require('./script_buffers_as_script');

/** Generate a chain swap redeem script with a pkhash refund path

  {
    destination_public_key: <Destination Public Key Serialized String>
    payment_hash: <Payment Hash String>
    refund_public_key_hash: <Refund Public Key Hash Serialized String>
    timeout_block_height: <Swap Expiration Height Number>
  }

  @returns
  <Hex Serialized Redeem Script String>
*/
module.exports = args => {
  const destinationPublicKey = Buffer.from(args.destination_public_key, 'hex');
  const numberEncode = script.number.encode;
  const paymentHash = Buffer.from(args.payment_hash, 'hex');
  const refundPublicKeyHash = Buffer.from(args.refund_public_key_hash, 'hex');

  const cltv = numberEncode(bip65Encode({blocks: args.timeout_block_height}));

  const chainSwapScript = [
    OP_DUP,
    OP_SHA256, paymentHash, OP_EQUAL,
    OP_IF,
      OP_DROP,
      destinationPublicKey,
    OP_ELSE,
      cltv, OP_CHECKLOCKTIMEVERIFY, OP_DROP,
      OP_DUP, OP_HASH160, refundPublicKeyHash, OP_EQUALVERIFY,
    OP_ENDIF,
    OP_CHECKSIG,
  ];

  return scriptBuffersAsScript(chainSwapScript);
};

