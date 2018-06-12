const asyncAuto = require('async/auto');

const chainRpc = require('./call_chain_rpc');
const getBlockchainInfo = require('./get_blockchain_info');
const parseTokenValue = require('./parse_token_value');
const returnResult = require('./../async-util');

const cmd = require('./conf/rpc_commands').estimateSmartFee;

const bytesPerKb = 1e3;
const defaultBlockCount = 6;

/** Get blockchain fee rate

  {
    [blocks]: <Block Count Number> // defaults to 6
    network: <Network Name String>
  }

  @returns via cbk
  {
    fee_tokens_per_vbyte: <Fee Tokens per Vbyte Number>
  }
*/
module.exports = ({blocks, network}, cbk) => {
  const params = !blocks ? [defaultBlockCount] : [blocks];

  return chainRpc({cmd, network, params}, (err, res) => {
    if (!!err) {
      return cbk(err);
    }

    let parsedValue;

    if (!res || !res.feerate) {
      return cbk([500, 'ExpectedFeeRate']);
    }

    const value = (res.feerate / bytesPerKb).toString();

    try {
      parsedValue = parseTokenValue({value});
    } catch (e) {
      return cbk([500, 'FailedToParseTokenValue', e]);
    }

    return cbk(null, {fee_tokens_per_vbyte: parsedValue.tokens});
  });
};

