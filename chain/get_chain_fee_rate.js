const chainRpc = require('./call_chain_rpc');
const {estimateSmartFee} = require('./conf/rpc_commands');
const parseTokenValue = require('./parse_token_value');

const bytesPerKb = 1e3;
const cmd = estimateSmartFee;
const defaultFee = 10;
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

    let fee;
    let parsedValue;

    // Exit early when fee is not defined
    if (!!res && res.fee === -1) {
      return cbk(null, {fee_tokens_per_vbyte: defaultFee});
    }

    if (!!res && !!res.fee) {
      fee = res.fee;
    } else if (!!res && !!res.feerate) {
      fee = res.feerate;
    } else {
      return cbk([500, 'ExpectedFeeRate', res]);
    }

    const value = (fee / bytesPerKb).toString();

    try {
      parsedValue = parseTokenValue({value});
    } catch (e) {
      return cbk([500, 'FailedToParseTokenValue', e]);
    }

    return cbk(null, {fee_tokens_per_vbyte: parsedValue.tokens});
  });
};

