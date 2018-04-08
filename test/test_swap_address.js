const {equal} = require('tap');
const {throws} = require('tap');

const {swapAddress} = require('./../swaps');

const fixtures = {
  destination_public_key: '03f8109578aae1e5cfc497e466cf6ae6625497cd31886e87b2f4f54f3f0f46b539',
  payment_hash: '53ada8e6de01c26ff43040887ba7b22bddce19f8658fd1ba00716ed79d15cd5e',
  refund_public_key: '03ec0c1e45b709d708cd376a6f2daf19ac27be229647780d592e27d7fb7efb207a',
  refund_public_key_hash: '10fd1a974109be99bdf95334f8b7625bda0e90be',
  timeout_block_height: 515924,
};

// Derive standard public key swap address details
{
  const details = swapAddress({
    destination_public_key: fixtures.destination_public_key,
    payment_hash: fixtures.payment_hash,
    refund_public_key: fixtures.refund_public_key,
    timeout_block_height: fixtures.timeout_block_height,
  });

  equal(details.p2sh_address, '2NFpcmuukTNTRqNWjvePBo7mo43CX1wXa8s');
  equal(details.p2sh_output_script, 'a914f7a383ef317e5b348e3e65b7d592751a76c956b887');
  equal(details.p2sh_p2wsh_address, '2N2sPWpXdcAPiMNH45MNGTC2Sa5TRRL2sGg');
  equal(details.p2sh_p2wsh_output_script, 'a91469900f19fc9114d800827a8192205036e67f55f187');
  equal(details.p2wsh_address, 'tb1qu3t5vf4z7a2nukqy3q3uh3y9l2gx5qvtks58xpxhzgeqa58yg50qa8kzmj');
  equal(details.redeem_script, 'a82053ada8e6de01c26ff43040887ba7b22bddce19f8658fd1ba00716ed79d15cd5e87632103f8109578aae1e5cfc497e466cf6ae6625497cd31886e87b2f4f54f3f0f46b539670354df07b1752103ec0c1e45b709d708cd376a6f2daf19ac27be229647780d592e27d7fb7efb207a68ac');
  equal(details.witness_output_script, '0020e4574626a2f7553e58048823cbc485fa906a018bb4287304d712320ed0e4451e');
}

// Derive standard public key hash swap address details
{
  const details = swapAddress({
    destination_public_key: fixtures.destination_public_key,
    payment_hash: fixtures.payment_hash,
    refund_public_key_hash: fixtures.refund_public_key_hash,
    timeout_block_height: fixtures.timeout_block_height,
  });

  equal(details.p2sh_address, '2NAWeCAdGyKfx6tEXnK8fui1rfq3Wsuj7in');
  equal(details.p2sh_output_script, 'a914bd64953d2427dd5e8ccc4e9ea998f23ad88edb9687');
  equal(details.p2sh_p2wsh_output_script, 'a9140d533ac62439b2eeba5028ca3c7e9a02ce105a2e87');
  equal(details.p2sh_p2wsh_address, '2MtTgUfrgPtcYF6BDHP7fD2Eg5hVTMEuvMC');
  equal(details.p2wsh_address, 'tb1qvcl3wyykqpem0gvpcj9e6xrv86yfx8plxz7ed65tgsreq60ssejss3kngd');
  equal(details.redeem_script, '76a82053ada8e6de01c26ff43040887ba7b22bddce19f8658fd1ba00716ed79d15cd5e8763752103f8109578aae1e5cfc497e466cf6ae6625497cd31886e87b2f4f54f3f0f46b539670354df07b17576a91410fd1a974109be99bdf95334f8b7625bda0e90be8868ac');
  equal(details.witness_output_script, '0020663f1710960073b7a181c48b9d186c3e88931c3f30bd96ea8b44079069f08665');
}

// No refund key should throw an error
{
  throws(() => {
    return swapAddress({
      destination_public_key: fixtures.destination_public_key,
      payment_hash: fixtures.payment_hash,
      timeout_block_height: fixtures.timeout_block_height,
    });
  },
  new Error('ExpectedRefundKey'));
}

