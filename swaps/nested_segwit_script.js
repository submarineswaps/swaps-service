const {encode} = require('varuint-bitcoin');
const {OP_0} = require('bitcoin-ops');

const {crypto} = require('./../tokenslib');
const scriptBuffersAsScript = require('./script_buffers_as_script');

const {sha256} = crypto;

/** Make the nested input redeem script for a nested segwit input

  {
    redeem: <Redeem Script Hex String>
  }

  @throws Error on invalid arguments

  @returns
  <P2SH Nested SegWit Input Redeem Script Hex String>
*/
module.exports = ({redeem}) => {
  if (!redeem) {
    throw new Error('ExpectedRedeemScriptForDummyInputScriptCreation');
  }

  const witnessVersion = encode(OP_0).toString('hex');

  const nestComponents = [witnessVersion, sha256(Buffer.from(redeem, 'hex'))];

  const nest = Buffer.from(scriptBuffersAsScript(nestComponents), 'hex');

  return scriptBuffersAsScript([nest]);
};

