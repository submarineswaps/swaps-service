const {isCashAddress} = require('bchaddrjs');
const {toLegacyAddress} = require('bchaddrjs');

const {networks} = require('./../tokenslib');
const {toOutputScript} = require('./../tokenslib').address;

/** Get an output script for an address

  {
    address: <Receive Address String>
    network: <Network Name String>
  }

  @returns
  <Output Script Hex>
*/
module.exports = ({address, network}) => {
  if (!address) {
    throw new Error('ExpectedAddressForOutputScript');
  }

  if (!network) {
    throw new Error('ExpectedNetworkForOutputScriptTranslation');
  }

  let normalizedAddress = address;

  if (!!networks[network].is_cash_address_network && isCashAddress(address)) {
    normalizedAddress = toLegacyAddress(address);
  }

  return toOutputScript(normalizedAddress, networks[network]).toString('hex');
};

