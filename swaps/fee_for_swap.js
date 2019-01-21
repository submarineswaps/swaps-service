const {max} = Math;
const {round} = Math;

const dustFactor = 6;
const estimatedClaimTxVSize = 200;
const swapRateDivisor = 1e6;

/** Calculate the fee tokens for a swap given rates and conversion guidance

  {
    base_rate: <Base Fee To Send To Destination Tokens Number>
    fee_tokens_per_vbyte: <Fee Tokens per Vbyte Number>
    rate_destination: <Exchange Rate In Destination Currency Number>
    rate_source: <Exchange Rate in Source Currency Number>
    send_tokens: <Send Tokens Number>
    swap_rate: <Swap Rate Tokens Per Million Number>
  }

  @throws Error

  @returns
  {
    converted_fee: <Converted Fee Tokens Number>
    fee: <Fee Tokens For Swap Number>
    tokens: <Total Expected Tokens Number>
  }
*/
module.exports = args => {
  if (args.base_rate === undefined) {
    throw new Error('ExpectedSwapBaseRateForSwapFee');
  }

  if (args.fee_tokens_per_vbyte === undefined) {
    throw new Error('ExpectedChainFeeTokensPerVbyteForClaimFeeCalculation');
  }

  if (!args.rate_destination) {
    throw new Error('ExpectedDestinationExchangeRateForSwapFee');
  }

  if (!args.rate_source) {
    throw new Error('ExpectedSourceExchangeRateForSwapFee');
  }

  if (!args.send_tokens) {
    throw new Error('ExpectedTokenSendingAmountValueForSwapFeeCalculation');
  }

  if (!args.swap_rate) {
    throw new Error('ExpectedSwapRateForSwapFeeCalculation');
  }

  const claimChainFee = args.fee_tokens_per_vbyte * estimatedClaimTxVSize;
  const conversionRate = args.rate_destination / args.rate_source;

  const baseFee = args.base_rate + claimChainFee;
  const feePercentage = args.swap_rate / swapRateDivisor;
  const minChainVal = (claimChainFee * dustFactor);

  const convertedTokens = round(args.send_tokens * conversionRate);

  const feeValue = round(baseFee + (convertedTokens * feePercentage));

  const expectedChainOutputValue = convertedTokens + feeValue;

  const fee = expectedChainOutputValue < minChainVal ? minChainVal : feeValue;

  const tokens = convertedTokens + fee;

  const convertedFee = round(fee / conversionRate);

  return {fee, tokens, converted_fee: convertedFee};
};
