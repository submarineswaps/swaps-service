const {OP_0} = require('bitcoin-ops');

const {crypto} = require('./../tokenslib');
const {script} = require('./../tokenslib');

const {compile} = script;
const {sha256} = crypto;

/** Encode p2wsh output script

  {
    script: <Redeem Script Hex String>
  }

  @returns
  <P2WSH Output Script Buffer>
*/
module.exports = ({script}) => {
  return compile([OP_0, sha256(Buffer.from(script, 'hex'))]);
};
