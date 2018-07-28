const {equal} = require('tap');

const scriptElements = require('./../../swaps/script_elements');

const fixtures = {
  preimage: 'ed72f47ae4414781bfe049427d078e23c3afc689cddc4ed89e1e14b51e4ef032',
  redeem_script: '76a820945d54559a7aca612629d7c8d1ff54c8f44e5d25adbee11f1edcb3e269f90b678763752103e87eb317a8215eae5852adb208825fd2630be0936a9b5b2853d30f6d224843766702b201b17576a9141a6473ff7b78bf09a61420d34087ed2d0f181f598868ac',
  script_signature: '473044022032d73e4644884e1b344d13981a1e097c7d38b9d9e3955e2d0edd4f6089824c62022020e660ca7594587555c51e4df82616e9d5b1dff21e9393b8f60840181f3225c04120ed72f47ae4414781bfe049427d078e23c3afc689cddc4ed89e1e14b51e4ef0324c6876a820945d54559a7aca612629d7c8d1ff54c8f44e5d25adbee11f1edcb3e269f90b678763752103e87eb317a8215eae5852adb208825fd2630be0936a9b5b2853d30f6d224843766702b201b17576a9141a6473ff7b78bf09a61420d34087ed2d0f181f598868ac',
  signature: '3044022032d73e4644884e1b344d13981a1e097c7d38b9d9e3955e2d0edd4f6089824c62022020e660ca7594587555c51e4df82616e9d5b1dff21e9393b8f60840181f3225c041',
};

const tests = {
  script_elements_returned_from_script_sig: {
    expected: [fixtures.signature, fixtures.preimage, fixtures.redeem_script],
    script: fixtures.script_signature,
    witness: [],
  },
};

Object.keys(tests).map(k => tests[k]).forEach(({expected, script, witness}) => {
  const scriptSig = Buffer.from(script, 'hex');

  const elements = scriptElements({witness, script: scriptSig});

  const [signature, preimage, redeem] = elements;
  const [expectedSignature, expectedPreimage, expectedRedeem] = expected;

  equal(signature.toString('hex'), expectedSignature);
  equal(preimage.toString('hex'), expectedPreimage);
  equal(redeem.toString('hex'), expectedRedeem);

  return;
});
