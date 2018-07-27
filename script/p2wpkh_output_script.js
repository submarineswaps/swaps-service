const {OP_0} = require('bitcoin-ops');

const {script} = require('./../tokenslib');

const {compile} = script;

/** Pay to Witness Public Key Hash Output Script

  {
    hash: <Public Key Hash Hex String>
  }

  @returns
  <Pay to Witness Public Key Hash Output Script Buffer>
*/
module.exports = ({hash}) => {
  return compile([OP_0, Buffer.from(hash, 'hex')]);
};

