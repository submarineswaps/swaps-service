const {equal} = require('tap');

const addressDetails = require('./../chain/address_details');

const fixtures = {
  testnet_p2sh: {
    address: '2MzQwSSnBHWHqSAqtTVQ6v47XtaisrJa1Vc',
    expected: {
      data: null,
      hash: '4e9f39ca4688ff102128ea4ccda34105324305b0',
      type: 'p2sh',
      version: 196,
    },
    network: 'testnet',
  },

  testnet_p2pkh: {
    address: 'mipcBbFg9gMiCh81Kj8tqqdgoZub1ZJRfn',
    expected: {
      data: null,
      hash: '243f1394f44554f4ce3fd68649c19adc483ce924',
      type: 'p2pkh',
      version: 111,
    },
    network: 'testnet',
  },

  mainnet_p2sh: {
    address: '37GG3YV3xPRupqnLoLTXTcigCjuUuNbedx',
    expected: {
      data: null,
      hash: '3d22249c973708aaeda144775909b3d8521ece67',
      type: 'p2sh',
      version: 5,
    },
    network: 'bitcoin',
  },

  mainnet_p2pkh: {
    address: '1JpvZZMTDf3yZtbyNHP7uvT6xzMhZ29Dvg',
    expected: {
      data: null,
      hash: 'c38a663782e67e566505b889cb13e39195e36e5e',
      type: 'p2pkh',
      version: 0,
    },
    network: 'bitcoin',
  },
};

const tests = Object.keys(fixtures).map(n => fixtures[n]);

tests.forEach(({address, expected, network}) => {
  const details = addressDetails({address, network});

  equal(details.data, expected.data);
  equal(details.hash, expected.hash);
  equal(details.prefix, expected.prefix);
  equal(details.type, expected.type);
  equal(details.version, expected.version);

  return;
});

