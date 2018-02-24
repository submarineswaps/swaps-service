const {crypto, ECPair, networks} = require('bitcoinjs-lib');

const {testnet} = networks;
const {hash160} = crypto;

const errCode = require('./../conf/error_codes');

const notFound = -1;
const testnets = ['regtest', 'testnet'];

/** Generate a keypair

  {
    network: <Network Name String>
  }

  @returns via cbk
  {
    pk_hash: <Public Key Hash String>
    private_key: <Private Key WIF Encoded String>
    public_key: <Public Key Hex String>
  }
*/
module.exports = (args, cbk) => {
  const network = testnets.indexOf(args.network) !== notFound ? testnet : null;

  if (!network) {
    return cbk([errCode.local_err, 'Expected known network', args.network]);
  }

  const keyPair = ECPair.makeRandom({network});

  return cbk(null, {
    pk_hash: hash160(keyPair.getPublicKeyBuffer()).toString('hex'),
    private_key: keyPair.toWIF(),
    public_key: keyPair.getPublicKeyBuffer().toString('hex'),
  });
};

