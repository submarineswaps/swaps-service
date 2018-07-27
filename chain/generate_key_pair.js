const {address} = require('./../tokenslib');
const {crypto} = require('./../tokenslib');
const {ECPair} = require('./../tokenslib');
const {networks} = require('./../tokenslib');
const {payments} = require('./../tokenslib');
const {script} = require('./../tokenslib');

const {hash160} = crypto;
const notFound = -1;
const {p2pkh} = payments;
const {p2wpkh} = payments;

/** Generate a keypair

  {
    network: <Network Name String>
  }

  @throws
  <Error> on invalid arguments

  @returns
  {
    p2pkh_address: <Pay to Public Key Hash Base58 Address String>
    p2wpkh_address: <Pay to Witness Public Key Hash Bech32 Address String>
    pk_hash: <Public Key Hash String>
    private_key: <Private Key WIF Encoded String>
    public_key: <Public Key Hex String>
  }
*/
module.exports = ({network}) => {
  if (!network) {
    throw new Error('ExpectedNetwork');
  }

  const keyPair = ECPair.makeRandom({network: networks[network]});

  const net = networks[network];
  const pubkey = keyPair.publicKey;

  return {
    p2pkh_address: p2pkh({pubkey, network: net}).address,
    p2wpkh_address: p2wpkh({pubkey, network: net}).address,
    pk_hash: hash160(pubkey).toString('hex'),
    private_key: keyPair.toWIF(),
    public_key: pubkey.toString('hex'),
  };
};

