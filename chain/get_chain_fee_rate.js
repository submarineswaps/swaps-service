const chainRpc = require('./chain_rpc');
const parseTokenValue = require('./parse_token_value');

const cmd = require('./conf/rpc_commands').estimateSmartFee;

const bytesPerKb = 1e3;
const defaultBlockCount = 6;

/** Get blockchain fee rate

  {
    network: <Network Name String>
  }

  @returns via cbk
  {
    fee_tokens_per_vbyte: <Fee Tokens per Vbyte Number>
  }
*/
module.exports = ({network}, cbk) => {
  return chainRpc({cmd, network, params: [defaultBlockCount]}, (err, res) => {
    if (!!err) {
      return cbk(err);
    }

    let parsedValue;

    if (!res || !res.feerate) {
      return cbk([500, 'ExpectedFeeRate']);
    }

    const value = (res.feerate / bytesPerKb).toString();

    try { parsedValue = parseTokenValue({value}); } catch (e) {
      return cbk([500, 'FailedToParseTokenValue', e]);
    }

    return cbk(null, {fee_tokens_per_vbyte: parsedValue.tokens});
  });
};

