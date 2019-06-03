const {fromSeed} = require('bip32');
const {generateMnemonic} = require('bip39');
const {mnemonicToSeedSync} = require('bip39');
const {validateMnemonic} = require('bip39');

const {address} = require('./../tokenslib');
const {crypto} = require('./../tokenslib');
const {networks} = require('./../tokenslib');
const {payments} = require('./../tokenslib');
const {script} = require('./../tokenslib');

const {fromOutputScript} = address;
const {hash160} = crypto;
const minIndex = 0;
const maxIndex = 4294967295;
const {p2pkh} = payments;
const {p2wpkh} = payments;
const {SSS_CLAIM_BIP39_SEED} = process.env;

/** Server swap key pair

  {
    index: <Key Index Number>
    network: <Network Name String>
  }

  @throws
  <Error> on invalid index or network

  @returns
  {
    p2pkh_address: <Pay to Public Key Hash Base58 Address String>
    p2wpkh_address: <Pay to Witness Public Key Hash Bech32 Address String>
    pk_hash: <Public Key Hash String>
    private_key: <Private Key WIF Encoded String>
    public_key: <Public Key Hex String>
  }
*/
module.exports = ({index, network}) => {
  if (!validateMnemonic(SSS_CLAIM_BIP39_SEED)) {
    console.log([500, 'ExpectedValidMnemonic', generateMnemonic()]);
    process.exit();
  }

  if (index === undefined || index < minIndex || index > maxIndex) {
    throw new Error('ExpectedValidIndex');
  }

  if (!network || !networks[network]) {
    throw new Error('ExpectedValidNetwork');
  }

  const net = networks[network];
  const seed = mnemonicToSeedSync(SSS_CLAIM_BIP39_SEED);

  const root = fromSeed(seed, networks[network]);

  const keyPair = root.derivePath(`m/0'/0/${index}`);

  return {
    p2pkh_address: p2pkh({network: net, pubkey: keyPair.publicKey}).address,
    p2wpkh_address: p2wpkh({network: net, pubkey: keyPair.publicKey}).address,
    pk_hash: hash160(keyPair.publicKey).toString('hex'),
    private_key: keyPair.toWIF(),
    public_key: keyPair.publicKey.toString('hex'),
  };
};
