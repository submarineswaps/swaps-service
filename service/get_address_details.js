const {address, networks} = require('bitcoinjs-lib');

const publicKeyHashLength = 20;

/** Get address details

  {
    address: <Address String>
  }

  @returns via cbk
  {
    [data]: <Witness Address Data Hex String>
    [hash]: <Address Hash Data Hex String>
    is_testnet: <Is Testnet Address Bool>
    [prefix]: <Witness Prefix String>
    type: <Address Type String>
    version: <Address Version Number>
  }
*/
module.exports = (args, cbk) => {
  if (!args.address) {
    return cbk([400, 'ExpectedAddress']);
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
    return cbk([400, 'ExpectedValidAddress']);
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
    return cbk([400, 'UnknownAddressVersion']);
  }

  return cbk(null, {
    type,
    data: !details.data ? null : details.data.toString('hex'),
    hash: !details.hash ? null : details.hash.toString('hex'),
    is_testnet: isTestnet,
    prefix: details.prefix,
    version: details.version,
  });
};

