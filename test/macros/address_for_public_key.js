const bitcoinjsLib = require('bitcoinjs-lib');

/** Get a chain address for a public key

  {
    public_key: <Public Key String>
  }

  @returns via cbk
  {
    p2wpkh_address: <Pay to Witness Public Key Hash
  }
*/
module.exports = (args, cbk) => {
  const network = bitcoinjsLib.networks.testnet;
  const publicKey = Buffer.from(args.public_key, 'hex');

  const hash = bitcoinjsLib.crypto.hash160(publicKey);

  const scriptPub = bitcoinjsLib.script.witnessPubKeyHash.output.encode(hash);

  const address = bitcoinjsLib.address.fromOutputScript(scriptPub, network);

  return cbk(null, {p2wpkh_address: address});
};

