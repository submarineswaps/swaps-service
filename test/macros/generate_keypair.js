const bitcoinjsLib = require('bitcoinjs-lib');

/** Generate a keypair

  {}

  @returns via cbk
  {
    private_key: <Private Key WIF Encoded String>
    public_key: <Public Key Hex String>
  }
*/
module.exports = (args, cbk) => {
  const network = bitcoinjsLib.networks.testnet;

  const keyPair = bitcoinjsLib.ECPair.makeRandom({network});

  return cbk(null, {
    private_key: keyPair.toWIF(),
    public_key: keyPair.getPublicKeyBuffer().toString('hex'),
  });
};

