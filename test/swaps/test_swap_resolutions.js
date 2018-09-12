const {equal} = require('tap');

const swapResolutions = require('./../../swaps/swap_resolutions');

const fixtures = {
  np2wsh_claim_transaction: {
    args: {
      inputs: [{
        hash: Buffer.from('285d227e2823c679c224b4d562a9b5b5b7b927badd483df9f4225c6fc761d754', 'hex'),
        index: 0,
        script: Buffer.from('22002043be0610272e1c0dc1cbeef21a7b8cdf257c1a54b3d4e4887416521bd49ebbe6', 'hex'),
        witness: [
          Buffer.from('3045022100ec78999a9e08087c9dec428494fe3bde06cab5a79b19c476a25fe2eed00730e902201765b16677dd0ec4c402aa64ee057e1ea560a52813343fd5f1a134eb206226fa01', 'hex'),
          Buffer.from('9a11bb7d34158497edc0f40a03bbfa606e37233c1cc16b26b4d3d0c18fb86bde', 'hex'),
          Buffer.from('76a914d0c3a2c094bbc9301549f0af85f6bd2330b9ab258763752103a81f284d64682c6dcb96a1cadd46a9102cacc3a8664b156a13fd79fcae8afb0667027802b17576a9148c62f608c4ffaf840ffef2089a3e34cab85df5d88868ac', 'hex'),
        ],
      }],
      network: 'regtest',
    },
    expected: {
      count: 1,
      outpoint: '54d761c76f5c22f4f93d48ddba27b9b7b5b5a962d5b424c279c623287e225d28:0',
      preimage: '9a11bb7d34158497edc0f40a03bbfa606e37233c1cc16b26b4d3d0c18fb86bde',
      script: '76a914d0c3a2c094bbc9301549f0af85f6bd2330b9ab258763752103a81f284d64682c6dcb96a1cadd46a9102cacc3a8664b156a13fd79fcae8afb0667027802b17576a9148c62f608c4ffaf840ffef2089a3e34cab85df5d88868ac',
      type: 'claim',
    },
  },
  np2wsh_refund_transaction: {
    args: {
      inputs: [{
        hash: Buffer.from('cf663e0aabb401e0362948932828908c2c09202eee6c7c36f526922f4996cfea', 'hex'),
        index: 0,
        script: Buffer.from('220020297df18ce6a24161125693d3f4ed4017c8b5b8e3dc0322aa67b836d42778467e', 'hex'),
        witness: [
          Buffer.from('30440220160f856010e72dd0cfba067b902382bbbc6031717c00fd3013a8b967c55a303902207f02e0afd3246151dbd2ebcf649a68e0d15bdf8bb2f217f868919fbd5c10997601', 'hex'),
          Buffer.from('029476dfdc86519011a460a3ea397f4a0d1d459cb5947ef53278688c9c0a69dd69', 'hex'),
          Buffer.from('76a914474bae727550db7fe9e8b3401f9212f6f66a8ef48763752102957f7bda09b441b4df84195b0b2e7204a8aebe42384fd058f1c7ae30ac6ec94b6702c901b17576a914fbf52df0a98760fba0d504f607fc9459676488688868ac', 'hex'),
        ],
      }],
      network: 'regtest',
    },
    expected: {
      count: 1,
      outpoint: 'eacf96492f9226f5367c6cee2e20092c8c90282893482936e001b4ab0a3e66cf:0',
      preimage: null,
      script: '76a914474bae727550db7fe9e8b3401f9212f6f66a8ef48763752102957f7bda09b441b4df84195b0b2e7204a8aebe42384fd058f1c7ae30ac6ec94b6702c901b17576a914fbf52df0a98760fba0d504f607fc9459676488688868ac',
      type: 'refund',
    },
  },
  witness_multisig_transaction: {
    args: {
      inputs: [{
        hash: Buffer.from('1be185bb8180cce6fff001c95f5e8d44e6804e7a8a6276cfc80a63ca18307fd4', 'hex'),
        index: 0,
        script: Buffer.from('', 'hex'),
        witness: [
          Buffer.from('', 'hex'),
          Buffer.from('3045022100e9aa0c6c19c73bc8ebc80d29f1efeca84cf8eaad6234e28795a623a7dc6cf78302202b9a1b02926e59da04b7406f5699af844d51648f91548331179cfa660fe296cc01', 'hex'),
          Buffer.from('3045022100e58a05d086eb745bf4e1b70efe0c0a31b33b05c505fb919f5cf0ffaf86d9c63302206b181ef5e63a1caa2fb71fccdf0a18f2b0e3976d8be179e17387a2501a692a9001', 'hex'),
          Buffer.from('52210375e00eb72e29da82b89367947f29ef34afb75e8654f6ea368e0acdfd92976b7c2103a1b26313f430c4b15bb1fdce663207659d8cac749a0e53d70eff01874496feff2103c96d495bfdd5ba4145e3e046fee45e84a8a48ad05bd8dbb395c011a32cf9f88053ae', 'hex'),
        ],
      }],
      network: 'testnet',
    },
    expected: {count: 0},
    transaction: '010000000001011be185bb8180cce6fff001c95f5e8d44e6804e7a8a6276cfc80a63ca18307fd40900000000ffffffff02408af7010000000017a9144b3f05cdeef067a60b042dfa682e1f8ee200bc7f8704a2710600000000220020701a8d401c84fb13e6baf169d59684e17abd9fa216c8cc5b9fc63d622ff8c58d0400483045022100e9aa0c6c19c73bc8ebc80d29f1efeca84cf8eaad6234e28795a623a7dc6cf78302202b9a1b02926e59da04b7406f5699af844d51648f91548331179cfa660fe296cc01483045022100e58a05d086eb745bf4e1b70efe0c0a31b33b05c505fb919f5cf0ffaf86d9c63302206b181ef5e63a1caa2fb71fccdf0a18f2b0e3976d8be179e17387a2501a692a90016952210375e00eb72e29da82b89367947f29ef34afb75e8654f6ea368e0acdfd92976b7c2103a1b26313f430c4b15bb1fdce663207659d8cac749a0e53d70eff01874496feff2103c96d495bfdd5ba4145e3e046fee45e84a8a48ad05bd8dbb395c011a32cf9f88053ae00000000',
  },
};

const fixturesToTest = [
  fixtures.np2wsh_claim_transaction,
  fixtures.np2wsh_refund_transaction,
  fixtures.witness_multisig_transaction,
]

fixturesToTest.forEach(({args, expected}) => {
  const {resolutions} = swapResolutions(args);

  // Make sure we see the expected number of resolutions in the transaction
  equal(resolutions.length, expected.count, 'RightResolutionsFound');

  // Check that the resolution type and redeem script are accurately derived
  resolutions.forEach(({outpoint, preimage, script, type}) => {
    equal(outpoint, expected.outpoint);
    equal(preimage, expected.preimage);
    equal(script, expected.script);
    equal(type, expected.type);

    return;
  });

  return;
});

