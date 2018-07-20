const {test} = require('tap');

const {addressDetails} = require('./../chain');

const fixtures = {
  bchtestnet_p2sh: {
    address: 'bchtest:pphntt8phcw52vq280l5zadhx8dzvzn6t5v9c0kuad',
    expected: {
      data: null,
      hash: '6f35ace1be1d45300a3bff4175b731da260a7a5d',
      type: 'p2sh',
      version: 196,
    },
    network: 'bchtestnet',
  },

  ltctestnet_p2sh: {
    address: 'QQo8HhGPwuyFt3ek2zgPiF9ppTRs5zf83p',
    expected: {
      data: null,
      hash: '2dfbe80a173e1ded99eae497f611086a865b0a72',
      type: 'p2sh',
      version: 58,
    },
    network: 'ltctestnet',
  },

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

  testnet_p2wpkh: {
    address: 'tb1qecrhxcf662qns27v932g3q3fml6p3t82cltfvz',
    expected: {
      data: 'ce0773613ad281382bcc2c54888229dff418acea',
      hash: null,
      prefix: 'tb',
      type: 'p2wpkh',
      version: null,
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

  test(`${network} ${address}`, t => {
    t.equal(details.data, expected.data, 'DataMatches');
    t.equal(details.hash, expected.hash, 'HashMatches');
    t.equal(details.prefix, expected.prefix, 'PrefixMatches');
    t.equal(details.type, expected.type, 'TypeMatches');
    t.equal(details.version, expected.version, 'VersionMatches');

    return t.end();
  });

  return;
});

