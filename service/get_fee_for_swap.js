const asyncAuto = require('async/auto');

const getExchangeRates = require('./get_exchange_rates');
const {returnResult} = require('./../async-util');

/** Given swap information, determine the number of tokens needed for a fee

  {
    cache: <Cache Type for Rate Data>
    network: <Chain Network Name String>
    tokens: <Lightning Tokens To Send Number>
  }

  @returns via cbk
  {
    fee: <Fee Tokens Number>
    tokens: <Total Tokens With Fee Number>
  }
*/
module.exports = ({cache, network, tokens}, cbk) => {
  return asyncAuto({
    // Check arguments
    validate: cbk => {
      if (!cache) {
        return cbk([400, 'ExpectedCacheForSwapFeeCheck']);
      }

      if (!network) {
        return cbk([400, 'ExpectedNetworkNameForSwapChainTokens']);
      }

      if (!tokens) {
        return cbk([400, 'ExpectedTokensForFeeCalculation']);
      }

      return cbk();
    },

    // Get exchange rate information
    getSwapRates: ['validate', ({}, cbk) => {
      return getExchangeRates({cache, networks: [network, 'testnet']}, cbk);
    }],

    // Final fee tokens necessary to complete the swap
    feeTokens: ['getSwapRates', ({getSwapRates}, cbk) => {
      const rates = {};

      getSwapRates.rates.forEach(({cents, fees, network}) => {
        return rates[network] = {cents, fees};
      });

      if (!rates[network]) {
        return cbk([400, 'UnexpectedNetworkForRatesQuery', network]);
      }

      const swapFee = rates[network].fees.find(n => n.network === 'testnet');

      if (!swapFee) {
        return cbk([500, 'ExpectedBaseFeeRate', rates[network]]);
      }

      const conversionRate = rates['testnet'].cents / rates[network].cents;

      const baseFee = swapFee.base;
      const feePercentage = swapFee.rate / 1e6 * 100;
      const convertedTokens = Math.round(tokens * conversionRate);

      const feeTokens = baseFee + (convertedTokens * feePercentage / 100);

      const fee = Math.round(feeTokens);

      return cbk(null, {fee, tokens: convertedTokens + fee});
    }],
  },
  returnResult({of: 'feeTokens'}, cbk));
};

