const bip65Encode = require('bip65').encode;
const {OP_CHECKLOCKTIMEVERIFY, OP_CHECKSIG, OP_DROP} = require('bitcoin-ops');
const {OP_ELSE, OP_ENDIF, OP_EQUAL, OP_HASH160, OP_IF} = require('bitcoin-ops');
const pushdataEncode = require('pushdata-bitcoin').encode;
const pushdataEncodingLen = require('pushdata-bitcoin').encodingLength;

const {crypto} = require('./../tokenslib');
const {script} = require('./../tokenslib');
const scriptBuffersAsScript = require('./script_buffers_as_script');

/** Generate a chain swap redeem script for a public key

  {
    destination_public_key: <Destination Public Key Serialized String>
    payment_hash: <Payment Hash String>
    refund_public_key: <Refund Public Key Serialized String>
    timeout_block_height: <Swap Expiration Height Number>
  }

  @throws
  <Error> on a script generation error

  @returns
  <Hex Serialized Redeem Script String>
*/
module.exports = args => {
  const destinationPublicKey = Buffer.from(args.destination_public_key, 'hex');
  const numberEncode = script.number.encode;
  const paymentHash = Buffer.from(args.payment_hash, 'hex');
  const refundPublicKey = Buffer.from(args.refund_public_key, 'hex');

  const cltv = numberEncode(bip65Encode({blocks: args.timeout_block_height}));

  /** Chain Swap Script:

    When spending the remote presents the preimage and their signature or the
    local presents a dummy value and their signature.

    Verification: take the top stack item, sha256 it, then see if it is the pay
    hash.

    If it's the same as the pay hash then push the remote pubkey on the stack

    If it's not? Push the cltv timeout value on the stack and make sure that
    the locktime of this transaction is greater than the timeout. Then push the
    local pubkey on the stack.

    Now we either have the remote or local pubkey on the stack. Check that the
    key on the stack signed the transaction.
  */
  const chainSwapScript = [
    OP_HASH160, crypto.ripemd160(paymentHash), OP_EQUAL,
    OP_IF,
      destinationPublicKey,
    OP_ELSE,
      cltv, OP_CHECKLOCKTIMEVERIFY, OP_DROP,
      refundPublicKey,
    OP_ENDIF,
    OP_CHECKSIG,
  ];

  return scriptBuffersAsScript(chainSwapScript);
};

