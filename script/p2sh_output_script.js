const {OP_EQUAL} = require('bitcoin-ops');
const {OP_HASH160} = require('bitcoin-ops');

const {crypto} = require('./../tokenslib');
const {script} = require('./../tokenslib');

const {compile} = script;
const {hash160} = crypto;

/** Given a script hash, encode it as a p2sh output script

  {
    script: <Redeem Script Hex String>
  }

  @returns
  <Output Script Buffer>
*/
module.exports = ({script}) => {
  return compile([OP_HASH160, hash160(Buffer.from(script, 'hex')), OP_EQUAL]);
};

