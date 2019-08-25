const chainRpc = require('./call_chain_rpc');
const {estimateSmartFee} = require('./conf/rpc_commands');
const {networks} = require('./../tokenslib');

const bytesPerKb = 1e3;
const cmd = estimateSmartFee;
const defaultFee = 10;
const defaultBlockCount = 30;
const divisibility = 1e8;
const noRbfMultiplier = 10;

/** Get blockchain fee rate

  {
    [blocks]: <Block Count Number> // defaults to 6
    network: <Network Name String>
    [priority]: <Priority Number>
  }

  @returns via cbk
  {
    fee_tokens_per_vbyte: <Fee Tokens per Vbyte Number>
  }
*/
module.exports = ({blocks, network, priority}, cbk) => {
  const params = !blocks ? [defaultBlockCount] : [blocks];

  // Exit early when there are no real fees
  if (network === 'regtest') {
    return cbk(null, {fee_tokens_per_vbyte: defaultFee});
  }

  return chainRpc({cmd, network, params, priority}, (err, res) => {
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

    // Increase fee conservativeness on networks with no RBF
    const noRbfFee = !!networks[network].is_rbf_disabled ? noRbfMultiplier : 1;

    const feeTokens = Math.ceil(fee / bytesPerKb * divisibility) * noRbfFee;

    return cbk(null, {fee_tokens_per_vbyte: feeTokens});
  });
};

