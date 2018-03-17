const {createHash} = require('crypto');
const {ECPair} = require('bitcoinjs-lib');
const {encode} = require('bolt11');
const {sign} = require('bolt11');
const {testnet} = require('bitcoinjs-lib').networks;
const uuidv4 = require('uuid/v4');

const preimageByteCount = 32;
const privKeySize = 32;
const uuidv4ByteCount = 16;

/** Generate a fake invoice payment preimage and payment hash pair

  {
    private_key: <WIF Encoded Private Key String>
  }

  @returns via cbk
  {
    invoice: <Lightning Invoice String>
    payment_hash: <Payment Hash Hex String>
    payment_preimage: <Payment Preimage Hex String>
  }
*/
module.exports = (args, cbk) => {
  if (!args.private_key) {
    return cbk([0, 'Expected private key']);
  }

  const keyPair = ECPair.fromWIF(args.private_key, testnet);
  const preimage = new Buffer(preimageByteCount);

  // Populate preimage bytes with a couple uuidv4s
  uuidv4({}, preimage);
  uuidv4({}, preimage, uuidv4ByteCount);

  // The invoice requires a payment hash and is signed with a private key.
  const payHash = createHash('sha256').update(preimage).digest('hex');
  const privKey = keyPair.d.toBuffer(privKeySize).toString('hex');

  const invoice = encode({tags: [{tagName: 'payment_hash', data: payHash}]});

  return cbk(null, {
    invoice: sign(invoice, privKey).paymentRequest,
    payment_hash: payHash,
    payment_preimage: preimage.toString('hex'),
  });
};

