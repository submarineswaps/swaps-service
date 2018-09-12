const {equal} = require('tap');

const {swapScriptDetails} = require('./../../swaps');

const fixtures = {
  swap_redeem_script: '76a914d0c3a2c094bbc9301549f0af85f6bd2330b9ab258763752103a81f284d64682c6dcb96a1cadd46a9102cacc3a8664b156a13fd79fcae8afb0667027802b17576a9148c62f608c4ffaf840ffef2089a3e34cab85df5d88868ac',
};

const details = swapScriptDetails({
  network: 'regtest',
  script: fixtures.swap_redeem_script,
});

equal(details.destination_public_key, '03a81f284d64682c6dcb96a1cadd46a9102cacc3a8664b156a13fd79fcae8afb06');
equal(details.p2sh_address, '2N6LsbohZzyaz4QjssfxnbwZLPJMGRSxbBt');
equal(details.p2sh_output_script, 'a9148fab1cbefac11b8aad3813ca34b9d72dcad8187687');
equal(details.p2sh_p2wsh_address, '2NE5HHz4FFV1ecrsJ7qF3gfJtA61HuGDKDX');
equal(details.p2sh_p2wsh_output_script, 'a914e4793da9954fff2f74e5796ee1974b26da44a3c587');
equal(details.p2wsh_address, 'tb1qgwlqvyp89cwqmswtamep57uvmujhcxj5k02wfzr5zefph4y7h0nqq5340t');
equal(details.payment_hash, 'd0c3a2c094bbc9301549f0af85f6bd2330b9ab25');
equal(details.refund_p2wpkh_address, 'tb1q3330vzxyl7hcgrl77gyf5035e2u9mawc5p8825');
equal(details.refund_public_key_hash, '8c62f608c4ffaf840ffef2089a3e34cab85df5d8');
equal(details.timelock_block_height, 632);
equal(details.witness_output_script, '002043be0610272e1c0dc1cbeef21a7b8cdf257c1a54b3d4e4887416521bd49ebbe6');

