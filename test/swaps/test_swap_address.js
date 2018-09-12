const {equal} = require('tap');
const {throws} = require('tap');

const {swapAddress} = require('./../../swaps');

const fixtures = {
  destination_public_key: '03f8109578aae1e5cfc497e466cf6ae6625497cd31886e87b2f4f54f3f0f46b539',
  network: 'testnet',
  payment_hash: '53ada8e6de01c26ff43040887ba7b22bddce19f8658fd1ba00716ed79d15cd5e',
  refund_public_key: '03ec0c1e45b709d708cd376a6f2daf19ac27be229647780d592e27d7fb7efb207a',
  refund_public_key_hash: '10fd1a974109be99bdf95334f8b7625bda0e90be',
  timeout_block_height: 515924,
};

// Derive standard public key swap address details
{
  const details = swapAddress({
    destination_public_key: fixtures.destination_public_key,
    network: fixtures.network,
    payment_hash: fixtures.payment_hash,
    refund_public_key: fixtures.refund_public_key,
    timeout_block_height: fixtures.timeout_block_height,
  });

  equal(details.p2sh_address, '2NAVNhVAT4fqpdhR9xnNArMS29eAQDQDBcH');
  equal(details.p2sh_output_script, 'a914bd273b9c514a49b1249ca48879ca07b69481520687');
  equal(details.p2sh_p2wsh_address, '2NE1k8Vby9J2aM4Gr9VsFgVKdhMXstS63zA');
  equal(details.p2sh_p2wsh_output_script, 'a914e3cdfa98d9d9b5a7641b64881790627d596bbcf787');
  equal(details.p2wsh_address, 'tb1qn23cwem84kdkk0w805pvgy3qg2nvatngfpxsmqtg4y268kn3vnhqew9jna');
  equal(details.redeem_script, 'a914e2ac8cb97af3d59b1c057db4b0c4f9aa12a9127387632103f8109578aae1e5cfc497e466cf6ae6625497cd31886e87b2f4f54f3f0f46b539670354df07b1752103ec0c1e45b709d708cd376a6f2daf19ac27be229647780d592e27d7fb7efb207a68ac');
  equal(details.witness_output_script, '00209aa3876767ad9b6b3dc77d02c4122042a6ceae68484d0d8168a915a3da7164ee');
}

// Derive standard public key hash swap address details
{
  const details = swapAddress({
    destination_public_key: fixtures.destination_public_key,
    network: fixtures.network,
    payment_hash: fixtures.payment_hash,
    refund_public_key_hash: fixtures.refund_public_key_hash,
    timeout_block_height: fixtures.timeout_block_height,
  });

  equal(details.p2sh_address, '2N71ZcQEpPbyamsQXX4VKT7VbziB25zrro7');
  equal(details.p2sh_output_script, 'a91496fc515680d892a4910c16a919e083f268c4fc6587');
  equal(details.p2sh_p2wsh_output_script, 'a914c1c7d40364affdf37f5cd8924ebd67f1a0f238c687');
  equal(details.p2sh_p2wsh_address, '2NAuqncUDHErNcA9Umu7U1bdhCRjt3bkP8u');
  equal(details.p2wsh_address, 'tb1qkcavdkmfj7z8ekrnxerxpq5wrr8e66yhr0rsktalrdvtgy8n0czqsad2sm');
  equal(details.redeem_script, '76a914e2ac8cb97af3d59b1c057db4b0c4f9aa12a912738763752103f8109578aae1e5cfc497e466cf6ae6625497cd31886e87b2f4f54f3f0f46b539670354df07b17576a91410fd1a974109be99bdf95334f8b7625bda0e90be8868ac');
  equal(details.witness_output_script, '0020b63ac6db6997847cd873364660828e18cf9d68971bc70b2fbf1b58b410f37e04');
}

// No refund key should throw an error
{
  throws(() => {
    return swapAddress({
      destination_public_key: fixtures.destination_public_key,
      network: fixtures.network,
      payment_hash: fixtures.payment_hash,
      timeout_block_height: fixtures.timeout_block_height,
    });
  },
  new Error('ExpectedRefundKey'));
}

