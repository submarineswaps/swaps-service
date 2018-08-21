const asyncAuto = require('async/auto');

const {feeForSwap} = require('./../swaps');
const getExchangeRates = require('./get_exchange_rates');
const {getRecentFeeRate} = require('./../blocks');
const {returnResult} = require('./../async-util');

/** Given swap information, determine the number of tokens needed for a fee

  {
    cache: <Cache Type for Rate Data>
    network: <Chain Network Name String>
    to: <Lightning Network Name String>
    tokens: <Lightning Tokens To Send Number>
  }

  @returns via cbk
  {
    converted_fee: <Converted Fee Tokens Number>
    fee: <Fee Tokens Number>
    tokens: <Total Tokens With Fee Number>
  }
*/
module.exports = ({cache, network, to, tokens}, cbk) => {
  return asyncAuto({
    // Check arguments
    validate: cbk => {
      if (!cache) {
        return cbk([400, 'ExpectedCacheForSwapFeeCheck']);
      }

      if (!network) {
        return cbk([400, 'ExpectedNetworkNameForSwapChainTokens']);
      }

      if (!to) {
        return cbk([400, 'ExpectedLightningNetworkToSendToName']);
      }

      if (!tokens) {
        return cbk([400, 'ExpectedTokensForFeeCalculation']);
      }

      return cbk();
    },

    // Get swap fee rate information
    getChainFee: ['validate', ({}, cbk) => {
      return getRecentFeeRate({cache, network}, cbk);[]
    }],

    // Get exchange rate information
    getSwapRates: ['validate', ({}, cbk) => {
      return getExchangeRates({cache, networks: [network, to]}, cbk);
    }],

    // Mapped fee rates to networks
    rates: ['getSwapRates', ({getSwapRates}, cbk) => {
      const rates = {};

      getSwapRates.rates.forEach(({cents, fees, network}) => {
        return rates[network] = {cents, fees};
      });

      if (!rates[network]) {
        return cbk([400, 'UnexpectedNetworkForRatesQuery', network]);
      }

      if (!rates[to]) {
        return cbk([400, 'UnexpectedLightningNetworkForRatesQuery']);
      }

      const swapFee = rates[network].fees.find(n => n.network === to);

      if (!swapFee) {
        return cbk([500, 'ExpectedBaseFeeRate', rates[network]]);
      }

      return cbk(null, {
        base_rate: swapFee.base,
        rate_destination: rates[to].cents,
        rate_source: rates[network].cents,
        swap_rate: swapFee.rate,
      });
    }],

    // Final fee tokens necessary to complete the swap
    feeTokens: ['getChainFee', 'rates', ({getChainFee, rates}, cbk) => {
      try {
        const fees = feeForSwap({
          base_rate: rates.base_rate,
          fee_tokens_per_vbyte: getChainFee.fee_tokens_per_vbyte,
          rate_destination: rates.rate_destination,
          rate_source: rates.rate_source,
          send_tokens: tokens,
          swap_rate: rates.swap_rate,
        });

        return cbk(null, {
          converted_fee: fees.converted_fee,
          fee: fees.fee,
          tokens: fees.tokens,
        });
      } catch (err) {
        return cbk([500, 'FailedToCalculateFeeForSwap', err]);
      }
    }],
  },
  returnResult({of: 'feeTokens'}, cbk));
};

