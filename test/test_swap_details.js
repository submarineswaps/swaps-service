const {equal} = require('tap');

const {swapScriptDetails} = require('./../swaps');

const fixtures = {
  refund_p2wpkh_address: 'tb1q2pfsl9044y9ettl2q92n6f2wy3370k0rez5c8j',
  swap_redeem_script: '76a82035f0a90d2801bb2b6a671fe66775673b420e768b66ded3bffdbde28f72f3923f87637521036133117817fd289b86cc686e7744842fdebffaa996e9691563cc1e60b8447f87670317aa13b17576a91450530f95f5a90b95afea01553d254e2463e7d9e38868ac',
  timelock_block_height: 1288727,
};

const details = swapScriptDetails({redeem_script: fixtures.swap_redeem_script});

equal(details.refund_p2wpkh_address, fixtures.refund_p2wpkh_address);
equal(details.timelock_block_height, fixtures.timelock_block_height);

