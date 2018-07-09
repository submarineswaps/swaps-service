const {address} = require('./../tokenslib');
const {crypto} = require('./../tokenslib');
const {ECPair} = require('./../tokenslib');
const {networks} = require('./../tokenslib');
const {script} = require('./../tokenslib');

const {fromOutputScript} = address;
const {hash160} = crypto;
const notFound = -1;

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

  // For pay to public key hash, we need the RIPE160 hash of the pubKey
  const publicKeyHash = hash160(keyPair.getPublicKeyBuffer());

  // A witness output script will include the pkhash and a version byte
  const witnessOutput = script.witnessPubKeyHash.output.encode(publicKeyHash);

  // A p2wpkh address is a bech32 encoded address
  const p2wpkhAddress = fromOutputScript(witnessOutput, networks[network]);

  return {
    p2pkh_address: keyPair.getAddress(),
    p2wpkh_address: p2wpkhAddress,
    pk_hash: publicKeyHash.toString('hex'),
    private_key: keyPair.toWIF(),
    public_key: keyPair.getPublicKeyBuffer().toString('hex'),
  };
};

