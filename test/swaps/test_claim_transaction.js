const {test} = require('tap');

const {claimTransaction} = require('./../../swaps');
const {Transaction} = require('./../../tokenslib');

// Test data
const fixtures = {
  max_fee: 1e5,
  utxo: {tokens: 5000000000},
};

// Test scenarios
const tests = {
  // An invalid scriptPub fails the claim transaction
  bad_script_fails_claim: {
    args: {
      current_block_height: 438,
      destination: 'mqdWL4Ezj3PCMm1MzaQguyfBntZn6ppLxy',
      fee_tokens_per_vbyte: 100,
      network: 'regtest',
      preimage: '9a11bb7d34158497edc0f40a03bbfa606e37233c1cc16b26b4d3d0c18fb86bde',
      private_key: 'cNoEujzXeZq2U9qPVd3u5XAd2tXPc7oZvGVxZZXRPQd5oaa11d31',
      utxos: [{
        redeem: '76a914d0c3a2c094bbc9301549f0af85f6bd2330b9ab258763752103a81f284d64682c6dcb96a1cadd46a9102cacc3a8664b156a13fd79fcae8afb0667027802b17576a9148c62f608c4ffaf840ffef2089a3e34cab85df5d88868ac',
        script: 'a914e5793da9954fff2f74e5796ee1974b26da44a3c587',
        tokens: fixtures.utxo.tokens,
        transaction_id: '285d227e2823c679c224b4d562a9b5b5b7b927badd483df9f4225c6fc761d754',
        vout: 0,
      }],
    },
    err: 'UnrecognizedScriptPub',
    msg: 'Claim transaction does not allow an invalid script pub to claim',
  },

  // An invalid fee fails the claim transaction
  bad_fee_fails_claim: {
    args: {
      current_block_height: 438,
      destination: 'mqdWL4Ezj3PCMm1MzaQguyfBntZn6ppLxy',
      fee_tokens_per_vbyte: 7330000,
      network: 'regtest',
      preimage: '9a11bb7d34158497edc0f40a03bbfa606e37233c1cc16b26b4d3d0c18fb86bde',
      private_key: 'cNoEujzXeZq2U9qPVd3u5XAd2tXPc7oZvGVxZZXRPQd5oaa11d31',
      utxos: [{
        redeem: '76a914d0c3a2c094bbc9301549f0af85f6bd2330b9ab258763752103a81f284d64682c6dcb96a1cadd46a9102cacc3a8664b156a13fd79fcae8afb0667027802b17576a9148c62f608c4ffaf840ffef2089a3e34cab85df5d88868ac',
        script: 'a914e4793da9954fff2f74e5796ee1974b26da44a3c587',
        tokens: fixtures.utxo.tokens,
        transaction_id: '285d227e2823c679c224b4d562a9b5b5b7b927badd483df9f4225c6fc761d754',
        vout: 0,
      }],
    },
    err: 'FeesTooHighToClaim',
    msg: 'Claim transaction does not allow an excessive fee when claiming',
  },

  // Successful bcashregtest p2sh claim transaction
  bcashregtest_p2sh_pk_claim_transaction: {
    args: {
      current_block_height: 438,
      destination: 'RVWfKfD1R4MeFbg7eBGcffJLZSKBD1TuX5',
      fee_tokens_per_vbyte: 100,
      network: 'bcashregtest',
      preimage: '5169df859e87ae7c017b0fcd33afafb440592065a140095e40ebc606ec1d3313',
      private_key: 'EPEvjtH8NXfbru18oT3DR5RNGjG6f2HoPR2pwdFoFc6yQ6eeEzfP',
      utxos: [{
        redeem: 'a9140840637867e7fc79f7fd9e0573dc694018882f7f876321024aef126294e093def19aadecd96fd2a751bbf509d261c12b452db9ca9235268c67027802b1752103e93fe7771857602a15f1f52d78216f547e56e40c218664678c37ea707a08492a68ac',
        script: 'a9145b8ff37d97bd5335a55d8d82f571a87e9e3c618787',
        tokens: fixtures.utxo.tokens,
        transaction_id: '4fb498cbf85c348d7041bf4295f89027609efcfa961e38332fad151901ca9710',
        vout: 0,
      }],
    },
    claim: '01000000011097ca011915ad2f33381e96fafc9e602790f89542bf41708d345cf8cb98b44f00000000d0483045022100df75bd8a14515730d240be4f9465faa2db0ccb8bda23a11f7d9b1126583da11202200882ded73517a7f5c9a6720e68ac45359f81bd398ffef8a608ecb1c20da972d141205169df859e87ae7c017b0fcd33afafb440592065a140095e40ebc606ec1d33134c64a9140840637867e7fc79f7fd9e0573dc694018882f7f876321024aef126294e093def19aadecd96fd2a751bbf509d261c12b452db9ca9235268c67027802b1752103e93fe7771857602a15f1f52d78216f547e56e40c218664678c37ea707a08492a68ac0000000001287f052a010000001976a914ddeeaa4ab34383907d0dcaed5a816948ee205ad388acb6010000',
    msg: 'Bcashregtest p2sh pk claim transaction is formed correctly',
  },

  // Successful bcashregtest p2sh pkhash claim transaction
  bcashregtest_p2sh_pkhash_claim_transaction: {
    args: {
      current_block_height: 438,
      destination: 'RTDK2AhGDnvXTgnyWKejQSAjtHmL2a9gUA',
      fee_tokens_per_vbyte: 100,
      network: 'bcashregtest',
      preimage: 'c9bdda8b6dfeefe3b442ddc8399df520013b4b5430ae01144fc4c03d9ca26098',
      private_key: 'ELg1DNDYzmMJmVsQeXFE2v6ciQStKFwR2jPzEVpKCgAHSCiSNyQ9',
      utxos: [{
        redeem: '76a914cc139a689ec3e62636b04e7ba7da25e088cf4190876375210228bd9c962e0f50f261c0c4b083185dd2f2b030c5211a023ede9da44b6f89fcb967027802b17576a914729246902bf46da67e17a0d062a235ba7cc3f51d8868ac',
        script: 'a9148e5a33c6a41528bc6c783b6d4d852bb66d11a29287',
        tokens: fixtures.utxo.tokens,
        transaction_id: '6bcafbe282512e7e0e6e9213745af7953fcf3e205cc3d9b5c49c2ddbed947225',
        vout: 0,
      }],
    },
    claim: '0100000001257294eddb2d9cc4b5d9c35c203ecf3f95f75a7413926e0e7e2e5182e2fbca6b00000000c747304402201aac98c974e658e0a4456fc58a84cb9234806c4911b5c47368bf31034929837902201ebe3ae3b44c2e5c2fe52ae4a9555e4d5ad0623d5840716de7d03d15b32cbdbb4120c9bdda8b6dfeefe3b442ddc8399df520013b4b5430ae01144fc4c03d9ca260984c5c76a914cc139a689ec3e62636b04e7ba7da25e088cf4190876375210228bd9c962e0f50f261c0c4b083185dd2f2b030c5211a023ede9da44b6f89fcb967027802b17576a914729246902bf46da67e17a0d062a235ba7cc3f51d8868ac0000000001ac82052a010000001976a914c4b665379555a9736543b8d042bf9461dfad432588acb6010000',
    msg: 'Bcashregtest p2sh pkhash claim transaction is formed correctly',
  },

  // Successful regtest p2sh pk claim transaction
  regtest_p2sh_pk_claim_transaction: {
    args: {
      current_block_height: 438,
      destination: 'mtq9k2b7RSSwy6j5bEPPSPqykgaiGXzKZj',
      fee_tokens_per_vbyte: 100,
      network: 'regtest',
      preimage: '092c33eb7aeb3cd4ef0b78d2358d654ad34a31c5ddea25aee5de0b75e665473b',
      private_key: 'cT58oU561hkmTHBrr45WvM5FeuLnNBao8VMiRVHtjzpnRUxq98S5',
      utxos: [{
        vout: 0,
        redeem: 'a914d1337c1926544f0472d1e59b0b56a08d28634acd87632103bc947e8a9dc5e1e233d96c96c39ea05118c5933161bd1969daa1f6e0c1f8176167027802b17521025678eba19849a534b67150ef752cda0b4f510c1038816c2e4c4ea6e130cbebcc68ac',
        script: 'a914f4d8d74e5a616326dcf5a289f2a48270a0379ad187',
        tokens: fixtures.utxo.tokens,
        transaction_id: '387599aaf156f3026e9d575038de7f6efce4e83b2ed4d7c2cf278ff37158c4d5',
      }],
    },
    claim: '0100000001d5c45871f38f27cfc2d7d42e3be8e4fc6e7fde3850579d6e02f356f1aa99753800000000d048304502210087fd48a9f8a8085504164bd98f73b7b64279c3090347ae83d7ff0b2b24aedd07022010bb1c1ff610a703bb3bbd75fa013753043e2da3c46df963c8041e19f40d831b0120092c33eb7aeb3cd4ef0b78d2358d654ad34a31c5ddea25aee5de0b75e665473b4c64a914d1337c1926544f0472d1e59b0b56a08d28634acd87632103bc947e8a9dc5e1e233d96c96c39ea05118c5933161bd1969daa1f6e0c1f8176167027802b17521025678eba19849a534b67150ef752cda0b4f510c1038816c2e4c4ea6e130cbebcc68ac00000000018c7f052a010000001976a914920aadbd41da79f4e7df8ddf3a3ee5045877f52288acb6010000',
    msg: 'Regtest p2sh pk claim transaction is formed correctly',
  },

  // Successful regtest p2sh pkhash claim transaction
  regtest_p2sh_pkhash_claim_transaction: {
    args: {
      current_block_height: 438,
      destination: 'mjbivdawaJbPVqyjXgL5K7J9MRPZg1cuAM',
      fee_tokens_per_vbyte: 100,
      network: 'regtest',
      preimage: '9842f30ee0f1ed14d375040a98e52e3af7063f16d362b391a4be6067da7f575b',
      private_key: 'cRtAGrwytFDso6egj1KkLSWNGChv5oKmLsSuvHvzNV8sc3pvzidi',
      utxos: [{
        vout: 0,
        redeem: '76a9145222a2eb3b6f18926b1bfc8e8ed2ed7b6d3c889387637521022ef3b75dacb4b75bfbd1ad218cbc784d55f7f5b948b76533a694ea7a66ca447267027802b17576a914742a82db6b9457b0c903f5bb4c91c4e517f817068868ac',
        script: 'a9148e6aee4999fed1223b4934c7228c39b0d6e8d4b087',
        tokens: fixtures.utxo.tokens,
        transaction_id: '902550453ff1041d4c0bf58cfa031e0771e3a7043c697a59618e4f178966e9e8',
      }],
    },
    claim: '0100000001e8e96689174f8e61597a693c04a7e371071e03fa8cf50b4c1d04f13f4550259000000000c848304502210080ef85fea201ac79809eac1266c30ddfef7615eaba486f65c155fe5176486ccd02207cbe761d1677c4b477f24089689b725aa0844632007f80b4de25d249157908c801209842f30ee0f1ed14d375040a98e52e3af7063f16d362b391a4be6067da7f575b4c5c76a9145222a2eb3b6f18926b1bfc8e8ed2ed7b6d3c889387637521022ef3b75dacb4b75bfbd1ad218cbc784d55f7f5b948b76533a694ea7a66ca447267027802b17576a914742a82db6b9457b0c903f5bb4c91c4e517f817068868ac00000000011083052a010000001976a9142cc76c3ab6a5a1c71550154404c7b5627714c27e88acb6010000',
    msg: 'Regtest p2sh pkhash claim transaction is formed correctly',
  },

  // Successful regtest p2sh p2wsh pk claim transaction
  regtest_p2sh_p2wsh_pk_claim_transaction: {
    args: {
      current_block_height: 438,
      destination: 'mjLicS7MfaMVWhatpX19bsk2Z7tt4TPWH9',
      fee_tokens_per_vbyte: 100,
      network: 'regtest',
      preimage: '919559aafa26ebcfdcb449dcfd324a31864da39074f5aaa7c118419437dabc7b',
      private_key: 'cRuTzLcC542uscQx728SnZ4xyPnoGfWnjs634pWYNxWJG44THP3k',
      utxos: [{
        redeem: 'a91458e752cd1932f63bf05fc1d28551cbf7e7c161178763210286c7aa3e8f10d3066b67de25480dd83f43aa501ee8bb7be3593ed6fd7a23ec5867027802b1752102896ee0586d0a7ef75870b442d09899fde36dcabd27ec4e87e6c8079db98b1b7f68ac',
        script: 'a9146f731d1449450135114513fe962b6c9a2332797b87',
        tokens: fixtures.utxo.tokens,
        transaction_id: '71deebd0b61e15f2b8469cb10c7d435a8d53c549878cb6728b24ca844623d81c',
        vout: 0,
      }],
    },
    claim: '010000000001011cd8234684ca248b72b68c8749c5538d5a437d0cb19c46b8f2151eb6d0ebde710000000023220020940277aded29c5d3ce77dd309145eb31ba308a60536c0e8f4b5b3b8a3d1129ae00000000016cae052a010000001976a91429f0ebe31322c8bb442768d0bd8138c9b0da16be88ac0348304502210089da799945aa36925c3c229a3c42bea000846094f54ed14cb5d6ec83a080755102207b6d9f0f4ea52d7d6340fb4f29ce1504676316bbab5ac68130afe2eb7b6805550120919559aafa26ebcfdcb449dcfd324a31864da39074f5aaa7c118419437dabc7b64a91458e752cd1932f63bf05fc1d28551cbf7e7c161178763210286c7aa3e8f10d3066b67de25480dd83f43aa501ee8bb7be3593ed6fd7a23ec5867027802b1752102896ee0586d0a7ef75870b442d09899fde36dcabd27ec4e87e6c8079db98b1b7f68acb6010000',
    msg: 'Regtest p2sh p2wsh pk claim transaction is formed correctly',
  },

  // Successful regtest p2sh p2wsh pkhash claim transaction
  regtest_p2sh_p2wsh_pkhash_claim_transaction: {
    args: {
      current_block_height: 438,
      destination: 'mqdWL4Ezj3PCMm1MzaQguyfBntZn6ppLxy',
      fee_tokens_per_vbyte: 100,
      network: 'regtest',
      preimage: '9a11bb7d34158497edc0f40a03bbfa606e37233c1cc16b26b4d3d0c18fb86bde',
      private_key: 'cNoEujzXeZq2U9qPVd3u5XAd2tXPc7oZvGVxZZXRPQd5oaa11d31',
      utxos: [{
        redeem: '76a914d0c3a2c094bbc9301549f0af85f6bd2330b9ab258763752103a81f284d64682c6dcb96a1cadd46a9102cacc3a8664b156a13fd79fcae8afb0667027802b17576a9148c62f608c4ffaf840ffef2089a3e34cab85df5d88868ac',
        script: 'a914e4793da9954fff2f74e5796ee1974b26da44a3c587',
        tokens: fixtures.utxo.tokens,
        transaction_id: '285d227e2823c679c224b4d562a9b5b5b7b927badd483df9f4225c6fc761d754',
        vout: 0,
      }],
    },
    claim: '0100000000010154d761c76f5c22f4f93d48ddba27b9b7b5b5a962d5b424c279c623287e225d28000000002322002043be0610272e1c0dc1cbeef21a7b8cdf257c1a54b3d4e4887416521bd49ebbe6000000000134af052a010000001976a9146eee7ea3c84f41562ece0a72e797d25c1f23569c88ac03483045022100ec78999a9e08087c9dec428494fe3bde06cab5a79b19c476a25fe2eed00730e902201765b16677dd0ec4c402aa64ee057e1ea560a52813343fd5f1a134eb206226fa01209a11bb7d34158497edc0f40a03bbfa606e37233c1cc16b26b4d3d0c18fb86bde5c76a914d0c3a2c094bbc9301549f0af85f6bd2330b9ab258763752103a81f284d64682c6dcb96a1cadd46a9102cacc3a8664b156a13fd79fcae8afb0667027802b17576a9148c62f608c4ffaf840ffef2089a3e34cab85df5d88868acb6010000',
    msg: 'Regtest p2sh p2wsh pkhash claim transaction is formed correctly',
  },

  // Successful regtest p2wsh pk claim transaction
  regtest_p2wsh_pk_claim_transaction: {
    args: {
      current_block_height: 438,
      destination: 'n4VJNWr9e5a6Z64yzGtKEgqzHtV7A1kw4u',
      fee_tokens_per_vbyte: 100,
      network: 'regtest',
      preimage: 'bb431303b6a252decac74691dca97d806f617d464cc190b396c6d9328da58918',
      private_key: 'cT4yMf7qpcBcDzk15mtfNYnJhPvMGQ62TAN2nodk9pkfD2vyXbfz',
      utxos: [{
        redeem: 'a914a0738c92fde6361f09d28950c7bd0d2bf32b34be87632103be4a251dae719d565ce1d6a7a5787df99fc1ecc1f6e847567981a686f32abce167027802b1752103f7877d4ae985bb30b6f150ad6b6b9935c342432beed1a4781347b169c1e2417368ac',
        script: '00206f38b6ce82427d4df080a9833d06cc6c66ab816545c9fd4df50f9d1ca8430b9e',
        tokens: fixtures.utxo.tokens,
        transaction_id: 'a4fc673005944c1f23e8c683d06278f5b8615a5062439a70974d5ff3c41022df',
        vout: 0,
      }],
    },
    claim: '01000000000101df2210c4f35f4d97709a4362505a61b8f57862d083c6e8231f4c94053067fca40000000000000000000118bc052a010000001976a914fbfad20a812d6113692a80331d3ff01bcec5f55288ac03473044022061b4a74ca512756d5a24675ef9edc0924350901076657fffd397577bfc952f6f02203a5c0979fb641214e1833cb7f298574d27b0ad18926685cb7a10e58dfdf7e3560120bb431303b6a252decac74691dca97d806f617d464cc190b396c6d9328da5891864a914a0738c92fde6361f09d28950c7bd0d2bf32b34be87632103be4a251dae719d565ce1d6a7a5787df99fc1ecc1f6e847567981a686f32abce167027802b1752103f7877d4ae985bb30b6f150ad6b6b9935c342432beed1a4781347b169c1e2417368acb6010000',
    msg: 'Regtest p2wsh pk claim transaction is formed correctly',
  },

  // Successful regtest p2wsh pkhash claim transaction
  regtest_p2wsh_pkhash_claim_transaction: {
    args: {
      current_block_height: 438,
      destination: 'mvgo2VxYsWHA7bBKK92kvkkgs65c9ndgcK',
      fee_tokens_per_vbyte: 100,
      network: 'regtest',
      preimage: 'e0710ddc92d15f4951c4af24d06a14d5f0faa276958960f564f5b9d0dfa9b7d1',
      private_key: 'cNGieKooqDAzBLD9ysSouv9LQP1u2FZUqkCk8NZF274W3s6cG4t3',
      utxos: [{
        vout: 0,
        redeem: '76a91439b81702d69e8bd4efe689bc2a526a7705e981298763752103423a5547ef5550b68a23c4269c8d93e8873d79488cf298378738d84dac6cd66067027802b17576a914eee9e7e3a304afde17c9464b7efba51f84e15f758868ac',
        script: '002024c71fa334a28c49c757d29066561a0b0fd4f1a96a03d010356a09de81cb0332',
        tokens: fixtures.utxo.tokens,
        transaction_id: 'f924ff3eb405bedd0d0d26b998b14f324ad9672650b70d0a9ef788323b1f1b42',
      }],
    },
    claim: '01000000000101421b1f3b3288f79e0a0db7502667d94a324fb198b9260d0dddbe05b43eff24f900000000000000000001e0bc052a010000001976a914a6664f4828b5eebe21a895cfbf08004f29b0aaa988ac03483045022100d185993d545b3393d51c54149ef3db173b8b47be7a26b151523769b66f6e8b1202202a29de99982b5d5ecd4257359781dd4638b5d7b1cc54ff997573d9ebf4cf52ad0120e0710ddc92d15f4951c4af24d06a14d5f0faa276958960f564f5b9d0dfa9b7d15c76a91439b81702d69e8bd4efe689bc2a526a7705e981298763752103423a5547ef5550b68a23c4269c8d93e8873d79488cf298378738d84dac6cd66067027802b17576a914eee9e7e3a304afde17c9464b7efba51f84e15f758868acb6010000',
    msg: 'Regtest p2wsh pkhash claim transaction is formed correctly',
  },
};

// Run the tests
Object.keys(tests).map(t => tests[t]).forEach(({args, claim, err, msg}) => {
  return test(msg, t => {
    if (!!err) {
      t.throws(() => claimTransaction(args), new Error(err));
    } else {
      const {transaction} = claimTransaction(args);

      const tx = Transaction.fromHex(transaction);

      const [output] = tx.outs;

      const fee = fixtures.utxo.tokens - output.value;

      t.equal(transaction, claim);
      t.equal(tx.outs.length, [fixtures.utxo].length, 'OnlyOneOutput');
      t.ok(fee < fixtures.max_fee, 'NormalFee');
    };

    return t.end()
  });
});

