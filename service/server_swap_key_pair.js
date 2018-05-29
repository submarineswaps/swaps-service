const {address} = require('bitcoinjs-lib');
const {crypto} = require('bitcoinjs-lib');
const {generateMnemonic} = require('bip39');
const {HDNode} = require('bitcoinjs-lib');
const {mnemonicToSeed} = require('bip39');
const {networks} = require('bitcoinjs-lib');
const {script} = require('bitcoinjs-lib');
const {validateMnemonic} = require('bip39');

const {fromOutputScript} = address;
const {hash160} = crypto;
const minIndex = 0;
const maxIndex = 4294967295;
const {SSS_CLAIM_BIP39_SEED} = process.env;
const {testnet} = networks;

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

  const net = network === 'regtest' ? 'testnet' : network;

  if (!net || !networks[net]) {
    throw new Error('ExpectedValidNetwork');
  }

  const seed = mnemonicToSeed(SSS_CLAIM_BIP39_SEED);

  const root = HDNode.fromSeedBuffer(seed, networks[net]);

  const {keyPair} = root.derivePath(`m/0'/0/${index}`);

  const publicKeyHash = hash160(keyPair.getPublicKeyBuffer());

  // SegWit P2PWKH Output Script
  const witnessOutput = script.witnessPubKeyHash.output.encode(publicKeyHash);

  const p2wpkhAddress = fromOutputScript(witnessOutput, networks[net]);

  return {
    p2pkh_address: keyPair.getAddress(),
    p2wpkh_address: p2wpkhAddress,
    pk_hash: publicKeyHash.toString('hex'),
    private_key: keyPair.toWIF(),
    public_key: keyPair.getPublicKeyBuffer().toString('hex'),
  };
};

