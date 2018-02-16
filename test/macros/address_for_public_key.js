const bitcoinjsLib = require('bitcoinjs-lib');
const {address, crypto, networks, script} = require('bitcoinjs-lib');

const knownNetworks = ['regtest', 'testnet'];
const notFound = -1;

/** Get a chain address for a public key

  {
    network: <Network Name String>
    public_key: <Public Key String>
  }

  @returns via cbk
  {
    p2wpkh_address: <Pay to Witness Public Key Hash
  }
*/
module.exports = (args, cbk) => {
  if (knownNetworks.indexOf(args.network) === notFound) {
    return cbk([0, 'Unknown network']);
  }

  const network = networks.testnet;
  const publicKey = Buffer.from(args.public_key, 'hex');

  const hash = crypto.hash160(publicKey);

  const scriptPub = script.witnessPubKeyHash.output.encode(hash);

  const p2wpkhAddress = address.fromOutputScript(scriptPub, network);

  return cbk(null, {p2wpkh_address: p2wpkhAddress});
};

