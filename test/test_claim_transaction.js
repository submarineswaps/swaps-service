const {equal} = require('tap');
const {throws} = require('tap');

const {claimTransaction} = require('./../swaps');

const fixtures = {
  claim_transaction: '01000000000101156a861dc99d2a12a5ff63f710d132f6eba774648efc006332b674aad5b47b5100000000000000000001e0bc052a01000000160014153607c57d789c3da20a812aaf19a17bb9abe0ea03473044022017e6536de93982d2e0da4272c040f05ebeb5ecd41544a20645d34c202609ff63022018dee2d7e1ea74b3f72aaef4f5ac8e872585fa60715240a6a78db57dcb2d821b01200d0f000cd0c000c0ab0000000a0c00b0d00000c000000b0c0e0ca00e00000a0b6876a820035ff161edf1fb1db2c334f3b85e736cfe49d117fcf0d4741146c148941488ee8763752102cab08827d262384d8e1349078c8432d671bb468b9f60c7a298c8a9c0137dd96b67027802b17576a914e7c4f66eabfdbae4861f3de5331ab4f5622ad83f8868acb6010000',
  current_block_height: 438,
  destination: 'tb1qz5mq03ta0zwrmgs2sy427xdp0wu6hc829f8aar',
  dust_tokens: 10,
  fee_tokens_per_vbyte: 100,
  p2sh_claim_transaction: '01000000000101156a861dc99d2a12a5ff63f710d132f6eba774648efc006332b674aad5b47b5100000000232200200715b5f54b7148bc733c90d62c3f0b5d1691804702db8a2b8fe83d1651b7f85d0000000001e0bc052a01000000160014153607c57d789c3da20a812aaf19a17bb9abe0ea03473044022017e6536de93982d2e0da4272c040f05ebeb5ecd41544a20645d34c202609ff63022018dee2d7e1ea74b3f72aaef4f5ac8e872585fa60715240a6a78db57dcb2d821b01200d0f000cd0c000c0ab0000000a0c00b0d00000c000000b0c0e0ca00e00000a0b6876a820035ff161edf1fb1db2c334f3b85e736cfe49d117fcf0d4741146c148941488ee8763752102cab08827d262384d8e1349078c8432d671bb468b9f60c7a298c8a9c0137dd96b67027802b17576a914e7c4f66eabfdbae4861f3de5331ab4f5622ad83f8868acb6010000',
  preimage: '0d0f000cd0c000c0ab0000000a0c00b0d00000c000000b0c0e0ca00e00000a0b',
  private_key: 'cSWTkyuuPpVrkrqqr2JuydydUvXzzM9PJgPhTLFFAJmuA4RwLiQj',
  utxo: {
    redeem: '76a820035ff161edf1fb1db2c334f3b85e736cfe49d117fcf0d4741146c148941488ee8763752102cab08827d262384d8e1349078c8432d671bb468b9f60c7a298c8a9c0137dd96b67027802b17576a914e7c4f66eabfdbae4861f3de5331ab4f5622ad83f8868ac',
    script: Buffer.from('a91447bcf47b411e18cde5bf092c1d2d7270787f7de287', 'hex'),
    vout: 0,
    tokens: 5000000000,
    transaction_id: '517bb4d5aa74b6326300fc8e6474a7ebf632d110f763ffa5122a9dc91d866a15'
  },
};

// Test a standard claim transaction
{
  const {transaction} = claimTransaction({
    current_block_height: fixtures.current_block_height,
    destination: fixtures.destination,
    fee_tokens_per_vbyte: fixtures.fee_tokens_per_vbyte,
    preimage: fixtures.preimage,
    private_key: fixtures.private_key,
    utxos: [{
      redeem: fixtures.utxo.redeem,
      tokens: fixtures.utxo.tokens,
      transaction_id: fixtures.utxo.transaction_id,
      vout: fixtures.utxo.vout,
    }],
  });

  equal(transaction, fixtures.claim_transaction);
}

// Test a nested p2sh claim transaction
{
  const {transaction} = claimTransaction({
    current_block_height: fixtures.current_block_height,
    destination: fixtures.destination,
    fee_tokens_per_vbyte: fixtures.fee_tokens_per_vbyte,
    preimage: fixtures.preimage,
    private_key: fixtures.private_key,
    utxos: [{
      redeem: fixtures.utxo.redeem,
      script: fixtures.utxo.script,
      tokens: fixtures.utxo.tokens,
      transaction_id: fixtures.utxo.transaction_id,
      vout: fixtures.utxo.vout,
    }],
  });

  equal(transaction, fixtures.p2sh_claim_transaction);
}

// Test a claim transaction which cannot proceed because the outputs are dust
{
  throws(() => {
    return claimTransaction({
      current_block_height: fixtures.current_block_height,
      destination: fixtures.destination,
      fee_tokens_per_vbyte: fixtures.fee_tokens_per_vbyte,
      preimage: fixtures.preimage,
      private_key: fixtures.private_key,
      utxos: [{
        redeem: fixtures.utxo.redeem,
        tokens: fixtures.dust_tokens,
        transaction_id: fixtures.utxo.transaction_id,
        vout: fixtures.utxo.vout,
      }],
    });
  },
  new Error('FeesTooHighToClaim'));
}

