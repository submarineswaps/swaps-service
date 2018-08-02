const {test} = require('tap');

const {addressDetails} = require('./../../chain');
const {generateKeyPair} = require('./../../chain');

const tests = [{
  args: {network: 'testnet'},
  purpose: 'When generating a keypair, keys and addresses are returned',
}];

tests.forEach(({args, purpose}) => {
  return test(purpose, ({end, equal, ok}) => {
    const generated = generateKeyPair(args);
    const {network} = args;

    const p2pkh = generated.p2pkh_address;
    const p2wpkh = generated.p2wpkh_address;

    equal(addressDetails({network, address: p2pkh}).type, 'p2pkh');
    equal(addressDetails({network, address: p2pkh}).hash, generated.pk_hash);
    equal(addressDetails({network, address: p2wpkh}).type, 'p2wpkh');
    equal(addressDetails({network, address: p2wpkh}).data, generated.pk_hash);
    ok(!!generated.private_key);
    ok(!!generated.public_key);

    return end();
  });
});

