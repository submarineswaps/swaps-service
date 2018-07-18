const {isCashAddress} = require('bchaddrjs');
const {toLegacyAddress} = require('bchaddrjs');

const {address} = require('./../tokenslib');
const {networks} = require('./../tokenslib');

const publicKeyHashLength = 20;

/** Derive address details

  {
    address: <Address String>
    network: <Network Name String>
  }

  @throws
  <Error> on invalid address

  @returns
  {
    [data]: <Witness Address Data Hex String>
    [hash]: <Address Hash Data Hex String>
    [prefix]: <Witness Prefix String>
    type: <Address Type String>
    version: <Address Version Number>
  }
*/
module.exports = (args) => {
  if (!args.address) {
    throw new Error('ExpectedAddress');
  }

  if (!args.network || !networks[args.network]) {
    throw new Error('ExpectedNetworkForAddress');
  }

  let normalAddress = args.address;

  switch (args.network) {
  case 'bchtestnet':
    if (isCashAddress(args.address)) {
      normalAddress = toLegacyAddress(args.address);
    }
    break;

  default:
    break;
  }

  let base58Address;
  let bech32Address;

  try { base58Address = address.fromBase58Check(normalAddress); } catch (e) {
    base58Address = null;
  }

  try { bech32Address = address.fromBech32(normalAddress); } catch (e) {
    bech32Address = null;
  }

  const details = base58Address || bech32Address;

  // Exit early: address does not parse as a bech32 or base58 address
  if (!details) {
    throw new Error('ExpectedValidAddress');
  }

  const isWitness = !!details.prefix;
  let type;

  if (isWitness) {
    switch (details.data.length) {
    case publicKeyHashLength:
      type = 'p2wpkh';
      break;

    case witnessScriptHashLength:
      type = 'p2wsh';
      break;

    default:
      throw new Error('UnexpectedWitnessDataLength');
    }
  } else {
    switch (details.version) {
    case (networks[args.network].pubKeyHash):
      type = 'p2pkh';
      break;

    case (networks[args.network].scriptHash):
      type = 'p2sh';
      break;

    default:
      throw new Error('UnknownAddressVersion');
    }
  }

  return {
    type,
    data: !details.data ? null : details.data.toString('hex'),
    hash: !details.hash ? null : details.hash.toString('hex'),
    prefix: details.prefix,
    version: isWitness ? null : details.version,
  };
};

