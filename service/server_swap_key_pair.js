const {generateMnemonic} = require('bip39');
const {HDNode} = require('bitcoinjs-lib');
const {mnemonicToSeed} = require('bip39');
const {networks} = require('bitcoinjs-lib');
const {validateMnemonic} = require('bip39');

const {OCW_CLAIM_BIP39_SEED} = process.env;

const minIndex = 0;
const maxIndex = 4294967295;

/** Server swap key pair

  {
    index: <Key Index Number>
    network: <Network Name String>
  }

  @throws
  <Error> on invalid index or network

  @returns
  {
    private_key: <Private Key WIF String>
    public_key: <Public Key Hex String>
  }
*/
module.exports = ({index, network}) => {
  if (!validateMnemonic(OCW_CLAIM_BIP39_SEED)) {
    console.log([500, 'ExpectedValidMnemonic', generateMnemonic()]);
    process.exit();
  }

  if (index === undefined || index < minIndex || index > maxIndex) {
    throw new Error('ExpectedValidIndex');
  }

  if (!network || !networks[network]) {
    throw new Error('ExpectedValidNetwork');
  }

  const seed = mnemonicToSeed(OCW_CLAIM_BIP39_SEED);

  const root = HDNode.fromSeedBuffer(seed, networks[network]);

  const {keyPair} = root.derivePath(`m/0'/0/${index}`);

  return {
    private_key: keyPair.toWIF(),
    public_key: keyPair.getPublicKeyBuffer().toString('hex'),
  };
};

