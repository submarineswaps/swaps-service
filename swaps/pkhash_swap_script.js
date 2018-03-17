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

  @throws
  <Error> on a script generation error

  @returns
  <Hex Serialized Redeem Script String>
*/
module.exports = args => {
  const destinationPublicKey = Buffer.from(args.destination_public_key, 'hex');
  const numberEncode = script.number.encode;
  const paymentHash = Buffer.from(args.payment_hash, 'hex');
  const refundPublicKeyHash = Buffer.from(args.refund_public_key_hash, 'hex');

  const cltv = numberEncode(bip65Encode({blocks: args.timeout_block_height}));

  /** Chain Swap Script (PKHash Refund)

    When spending the remote presents the preimage and their signature or the
    local presents their public key and their signature.

    Verification: take the top stack item, duplicate it to save it for later.

    sha256 the top stack item and compare it to see if it is the payment hash.

    If it's the same as the pay hash then eliminate the top stack item which is
    a duplicate of the payment hash. Push the remote key on the stack.

    If it's not? Push the cltv timeout value on the stack and make sure that
    the locktime of this transaction is greater than the timeout. Then dupe the
    top stack item which should be the public key. Hash that public key and
    compare it to the refund pkhash. Invalidate the tx if it doesn't match.

    Now we either have the remote or local pubkey on the stack. Check that the
    key on the stack signed the transaction.
  */
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

