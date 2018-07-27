const {createHash} = require('crypto');
const {encode} = require('bolt11');
const {sign} = require('bolt11');
const uuidv4 = require('uuid/v4');

const {ECPair} = require('./../../tokenslib');
const {networks} = require('./../../tokenslib');

const preimageByteCount = 32;
const privKeySize = 32;
const uuidv4ByteCount = 16;

/** Generate a fake invoice payment preimage and payment hash pair

  {
    network: <Network Name String>
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
  if (!args.network) {
    return cbk([0, 'ExpectedNetworkForInvoice']);
  }

  if (!args.private_key) {
    return cbk([0, 'ExpectedPrivateKeyForInvoiceSigning']);
  }

  const keyPair = ECPair.fromWIF(args.private_key, networks[args.network]);
  const preimage = new Buffer(preimageByteCount);

  // Populate preimage bytes with a couple uuidv4s
  uuidv4({}, preimage);
  uuidv4({}, preimage, uuidv4ByteCount);

  // The invoice requires a payment hash and is signed with a private key.
  const payHash = createHash('sha256').update(preimage).digest('hex');

  const privKey = keyPair.privateKey.toString('hex');

  const invoice = encode({tags: [{tagName: 'payment_hash', data: payHash}]});

  return cbk(null, {
    invoice: sign(invoice, privKey).paymentRequest,
    payment_hash: payHash,
    payment_preimage: preimage.toString('hex'),
  });
};

