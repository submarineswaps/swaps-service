const {address} = require('bitcoinjs-lib');
const {networks} = require('bitcoinjs-lib');

const publicKeyHashLength = 20;

/** Derive address details

  {
    address: <Address String>
  }

  @throws
  <Error> on invalid address

  @returns
  {
    [data]: <Witness Address Data Hex String>
    [hash]: <Address Hash Data Hex String>
    is_testnet: <Is Testnet Address Bool>
    [prefix]: <Witness Prefix String>
    type: <Address Type String>
    version: <Address Version Number>
  }
*/
module.exports = (args) => {
  if (!args.address) {
    throw new Error('ExpectedAddress');
  }

  let base58Address;
  let bech32Address;

  try { base58Address = address.fromBase58Check(args.address); } catch (e) {
    base58Address = null;
  }

  try { bech32Address = address.fromBech32(args.address); } catch (e) {
    bech32Address = null;
  }

  const details = base58Address || bech32Address;

  // Exit early: address does not parse as a bech32 or base58 address
  if (!details) {
    throw new Error('ExpectedValidAddress');
  }

  let isTestnet;
  const isWitness = !!details.prefix;
  let type;

  switch (details.version) {
  case 0: // P2PKH Mainnet
    isTestnet = details.prefix === 'tb';

    if (isWitness && details.data.length === publicKeyHashLength) {
      type = 'p2wpkh';
    } else if (isWitness && details.data.length === witnessScriptHashLength) {
      type = 'p2wsh';
    } else {
      type = 'p2pkh';
    }
    break;

  case 5: // P2SH Mainnet
    isTestnet = false;
    type = 'p2sh';
    break;

  case 111: // P2PKH Testnet
    isTestnet = true;
    type = 'p2pkh';
    break;

  case 196: // P2SH Testnet
    isTestnet = true;
    type = 'p2sh';
    break;

  default:
    throw new Error('UnknownAddressVersion');
  }

  return {
    type,
    data: !details.data ? null : details.data.toString('hex'),
    hash: !details.hash ? null : details.hash.toString('hex'),
    is_testnet: isTestnet,
    prefix: details.prefix,
    version: details.version,
  };
};

