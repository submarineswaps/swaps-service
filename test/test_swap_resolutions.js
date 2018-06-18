const {equal} = require('tap');

const swapResolutions = require('./../swaps/swap_resolutions');

const fixtures = {
  np2wsh_claim_transaction: {
    expected: {
      count: 1,
      outpoint: '3804dfee643317d0108d74ccbd96a46321abf92df2487a1b60c345772c45b4cc:0',
      preimage: '04c1b5544ea904139b443d56db7a49f5d5bef5a22fdaf0241b3889cb588d2d96',
      script: '76a820e2a18c356623279b664c46396f56a9d4210c70f07e5aca56702feceec3c7dc0787637521021f905f25401ac8d22a1125bff0bd309754b226764cf6d8c6b1005388fa0d1af6670351ba13b17576a914a03357088c2ca6bb10c0c62cadcd8c592cc683db8868ac',
      type: 'claim',
    },
    network: 'testnet',
    transaction: '01000000000101ccb4452c7745c3601b7a48f22df9ab2163a496bdcc748d10d0173364eedf043800000000232200204834d8725d8db6ee5d07b1db9408dcfebc6870255cedbfd5b797afa947d894b900000000012c7c0f000000000017a914985f45251d5d82b0c3081460645d0a72db0d8a49870347304402200588cd611b0d0c4950028cef3baeecd374bede1c87881d4c0d9dfaff6149c502022067b6f0e0c4db65f485ae57f7f4134f41e4268cc54efc32ef646949215f771b1b012004c1b5544ea904139b443d56db7a49f5d5bef5a22fdaf0241b3889cb588d2d966976a820e2a18c356623279b664c46396f56a9d4210c70f07e5aca56702feceec3c7dc0787637521021f905f25401ac8d22a1125bff0bd309754b226764cf6d8c6b1005388fa0d1af6670351ba13b17576a914a03357088c2ca6bb10c0c62cadcd8c592cc683db8868acc2b91300',
  },
  np2wsh_refund_transaction: {
    expected: {
      count: 1,
      outpoint: 'a5bfde178095e4e8ef1aa31792023c5887dd9425e9dd411b5b2e4be238209317:0',
      preimage: null,
      script: '76a8209b12afefaa28b210cf7ca711da1f14dd31ce226b0520d6953c542d420bd728ea87637521025a8799600d2388def96838a8a213d86758eb060dbceb1157e2f1412e4aaad3496703eeb113b17576a91402712c67099a80d34f7e82dd91ab6f2e1feac9848868ac',
      type: 'refund',
    },
    network: 'testnet',
    transaction: '0100000000010117932038e24b2e5b1b41dde92594dd87583c029217a31aefe8e4958017debfa500000000232200203c8d334559e0d6d4a830dde4d0b8d8d5fd84b17000222d4acf4332fa68dd1cb100000000010c3a0f000000000016001402712c67099a80d34f7e82dd91ab6f2e1feac984034830450221009fc87d545693a11bd7e0a1144c619165675b0dbf5107c1f8a5adbf8494c212ed02202ebf60878b8b2485568a60fda38d986bae8329633cb5b006c125328d349b09d20121033cba779b9d6334841bf821fe75780f3595983766f446476d6ff525d1d28a9ad16976a8209b12afefaa28b210cf7ca711da1f14dd31ce226b0520d6953c542d420bd728ea87637521025a8799600d2388def96838a8a213d86758eb060dbceb1157e2f1412e4aaad3496703eeb113b17576a91402712c67099a80d34f7e82dd91ab6f2e1feac9848868aceeb11300',
  },
  witness_multisig_transaction: {
    expected: {count: 0},
    network: 'testnet',
    transaction: '010000000001011be185bb8180cce6fff001c95f5e8d44e6804e7a8a6276cfc80a63ca18307fd40900000000ffffffff02408af7010000000017a9144b3f05cdeef067a60b042dfa682e1f8ee200bc7f8704a2710600000000220020701a8d401c84fb13e6baf169d59684e17abd9fa216c8cc5b9fc63d622ff8c58d0400483045022100e9aa0c6c19c73bc8ebc80d29f1efeca84cf8eaad6234e28795a623a7dc6cf78302202b9a1b02926e59da04b7406f5699af844d51648f91548331179cfa660fe296cc01483045022100e58a05d086eb745bf4e1b70efe0c0a31b33b05c505fb919f5cf0ffaf86d9c63302206b181ef5e63a1caa2fb71fccdf0a18f2b0e3976d8be179e17387a2501a692a90016952210375e00eb72e29da82b89367947f29ef34afb75e8654f6ea368e0acdfd92976b7c2103a1b26313f430c4b15bb1fdce663207659d8cac749a0e53d70eff01874496feff2103c96d495bfdd5ba4145e3e046fee45e84a8a48ad05bd8dbb395c011a32cf9f88053ae00000000',
  },
};

const fixturesToTest = [
  fixtures.np2wsh_claim_transaction,
  fixtures.np2wsh_refund_transaction,
  fixtures.witness_multisig_transaction,
]

fixturesToTest.forEach(({expected, network, transaction}) => {
  const {resolutions} = swapResolutions({network, transaction});

  // Make sure we see the expected number of resolutions in the transaction
  equal(resolutions.length, expected.count);

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

