const {OP_CHECKLOCKTIMEVERIFY, OP_CHECKSIG, OP_DROP} = require('bitcoin-ops');
const {OP_ELSE, OP_ENDIF, OP_EQUAL, OP_IF, OP_SHA256} = require('bitcoin-ops');
const pushdataEncode = require('pushdata-bitcoin').encode;
const pushdataEncodingLen = require('pushdata-bitcoin').encodingLength;

const numberAsBuf = require('./number_as_buffer');

const hexBase = require('./../conf/math').hex_base;

const bip65Encode = require('bip65').encode;
const {script} = require('bitcoinjs-lib');

/** Generate a chain swap redeem script

  {
    destination_public_key: <Destination Public Key Serialized String>
    payment_hash: <Payment Hash String>
    refund_public_key: <Refund Public Key Serialized String>
    timeout_block_height: <Swap Expiration Height Number>
  }

  @returns
  <Hex Serialized Redeem Script String>
*/
module.exports = (args, cbk) => {
  const destinationPublicKey = Buffer.from(args.destination_public_key, 'hex');
  const numberEncode = script.number.encode;
  const paymentHash = Buffer.from(args.payment_hash, 'hex');
  const refundPublicKey = Buffer.from(args.refund_public_key, 'hex');

  const cltv = numberEncode(bip65Encode({blocks: args.timeout_block_height}));

  const chainSwapScript = [
    OP_SHA256, paymentHash, OP_EQUAL,
    OP_IF,
      destinationPublicKey,
    OP_ELSE,
      cltv, OP_CHECKLOCKTIMEVERIFY, OP_DROP,
      refundPublicKey,
    OP_ENDIF,
    OP_CHECKSIG,
  ]
    .map(element => { // Convert numbers to buffers and hex data to pushdata
      if (Buffer.isBuffer(element)) {
        return Buffer.concat([numberAsBuf({number: element.length}), element]);
      } else {
        return Buffer.from(element.toString(hexBase), 'hex');
      }
    })
    .reduce((element, script) => Buffer.concat([element, script]));

  return chainSwapScript;
};

