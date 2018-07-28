const {equal} = require('tap');

const {swapScriptDetails} = require('./../../swaps');

const fixtures = {
  swap_redeem_script: '76a82035f0a90d2801bb2b6a671fe66775673b420e768b66ded3bffdbde28f72f3923f87637521036133117817fd289b86cc686e7744842fdebffaa996e9691563cc1e60b8447f87670317aa13b17576a91450530f95f5a90b95afea01553d254e2463e7d9e38868ac',
};

const details = swapScriptDetails({
  network: 'testnet',
  script: fixtures.swap_redeem_script,
});

equal(details.destination_public_key, '036133117817fd289b86cc686e7744842fdebffaa996e9691563cc1e60b8447f87');
equal(details.p2sh_address, '2NDuuc4wmPA76MKRipqAwqzDYN5Rc7Eudem');
equal(details.p2sh_output_script, 'a914e2b3648f6bcdf419490b70c90e4d5e4e3cb28aea87');
equal(details.p2sh_p2wsh_address, '2MvpJd9TXyJqkKZDEd4fg6uspY1imyBvcQY');
equal(details.p2sh_p2wsh_output_script, 'a9142729f94209df2a0308253e77e06cb933c4f30ee787');
equal(details.p2wsh_address, 'tb1q3cd2uypa3wywvh9ylfcr4kq5g8mztj8vnznqq67e3635dllvydss6gqm5z');
equal(details.payment_hash, '35f0a90d2801bb2b6a671fe66775673b420e768b66ded3bffdbde28f72f3923f');
equal(details.refund_p2wpkh_address, 'tb1q2pfsl9044y9ettl2q92n6f2wy3370k0rez5c8j');
equal(details.refund_p2wpkh_address, 'tb1q2pfsl9044y9ettl2q92n6f2wy3370k0rez5c8j');
equal(details.refund_public_key_hash, '50530f95f5a90b95afea01553d254e2463e7d9e3');
equal(details.timelock_block_height, 1288727);
equal(details.witness_output_script, '00208e1aae103d8b88e65ca4fa703ad81441f625c8ec98a6006bd98ea346ffec2361');

