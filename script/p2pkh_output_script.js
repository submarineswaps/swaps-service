const {OP_DUP} = require('bitcoin-ops');
const {OP_EQUALVERIFY} = require('bitcoin-ops');
const {OP_HASH160} = require('bitcoin-ops');
const {OP_CHECKSIG} = require('bitcoin-ops');

const {script} = require('./../tokenslib');

const {compile} = script;

/** Get an P2PKH Output Script

  {
    hash: <Public Key Hash Hex String>
  }

  @returns
  <P2PKH Output Script Buffer>
*/
module.exports = ({hash}) => {
  return compile([
    OP_DUP,
    OP_HASH160, Buffer.from(hash, 'hex'), OP_EQUALVERIFY,
    OP_CHECKSIG
  ]);
};

