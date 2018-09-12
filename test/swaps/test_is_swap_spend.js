const {equal} = require('tap');

const isSwapSpend = require('./../../swaps/is_swap_spend');
const {Transaction} = require('./../../tokenslib');

const {fromHex} = Transaction;

const fixtures = {
  np2wsh_transaction: {
    expected: true,
    network: 'regtest',
    tx: '0100000000010154d761c76f5c22f4f93d48ddba27b9b7b5b5a962d5b424c279c623287e225d28000000002322002043be0610272e1c0dc1cbeef21a7b8cdf257c1a54b3d4e4887416521bd49ebbe6000000000134af052a010000001976a9146eee7ea3c84f41562ece0a72e797d25c1f23569c88ac03483045022100ec78999a9e08087c9dec428494fe3bde06cab5a79b19c476a25fe2eed00730e902201765b16677dd0ec4c402aa64ee057e1ea560a52813343fd5f1a134eb206226fa01209a11bb7d34158497edc0f40a03bbfa606e37233c1cc16b26b4d3d0c18fb86bde5c76a914d0c3a2c094bbc9301549f0af85f6bd2330b9ab258763752103a81f284d64682c6dcb96a1cadd46a9102cacc3a8664b156a13fd79fcae8afb0667027802b17576a9148c62f608c4ffaf840ffef2089a3e34cab85df5d88868acb6010000',
  },
  witness_multisig_transaction: {
    expected: false,
    network: 'testnet',
    tx: '010000000001011be185bb8180cce6fff001c95f5e8d44e6804e7a8a6276cfc80a63ca18307fd40900000000ffffffff02408af7010000000017a9144b3f05cdeef067a60b042dfa682e1f8ee200bc7f8704a2710600000000220020701a8d401c84fb13e6baf169d59684e17abd9fa216c8cc5b9fc63d622ff8c58d0400483045022100e9aa0c6c19c73bc8ebc80d29f1efeca84cf8eaad6234e28795a623a7dc6cf78302202b9a1b02926e59da04b7406f5699af844d51648f91548331179cfa660fe296cc01483045022100e58a05d086eb745bf4e1b70efe0c0a31b33b05c505fb919f5cf0ffaf86d9c63302206b181ef5e63a1caa2fb71fccdf0a18f2b0e3976d8be179e17387a2501a692a90016952210375e00eb72e29da82b89367947f29ef34afb75e8654f6ea368e0acdfd92976b7c2103a1b26313f430c4b15bb1fdce663207659d8cac749a0e53d70eff01874496feff2103c96d495bfdd5ba4145e3e046fee45e84a8a48ad05bd8dbb395c011a32cf9f88053ae00000000',
  },
};

const fixturesToTest = [
  fixtures.np2wsh_transaction,
  fixtures.witness_multisig_transaction,
];

fixturesToTest.forEach(({expected, network, tx}) => {
  const [{script, witness}] = fromHex(tx).ins;

  equal(isSwapSpend({network, script, witness}), expected);

  return;
});

