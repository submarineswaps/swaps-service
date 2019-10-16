const {nextTick} = process;

const asyncAuto = require('async/auto');
const asyncTimeout = require('async/timeout');
const {getPendingChannels} = require('ln-service');
const {getRoutes} = require('ln-service');
const {probeForRoute} = require('ln-service');
const {returnResult} = require('asyncjs-util');
const {subscribeToProbe} = require('ln-service');

const {checkInvoicePayable} = require('./../swaps');
const {getExchangeRate} = require('./../fiat');
const getDetectedSwaps = require('./../pool/get_detected_swaps');
const getFeeForSwap = require('./get_fee_for_swap');
const {getRecentChainTip} = require('./../blocks');
const {getRecentFeeRate} = require('./../blocks');
const {lightningDaemon} = require('./../lightning');
const {parsePaymentRequest} = require('./../lightning');
const swapParameters = require('./swap_parameters');

const estimatedTxVirtualSize = 200;
const decBase = 10;
const defaultMaxHops = 5;
const fiatCurrency = 'USD';
const pathfindingTimeoutMs = 1000 * 25;
const probeLimit = 5;
const probeTimeoutMs = 25000 * 1000;

/** Get invoice details in the context of a swap

  {
    cache: <Cache Type String>
    check: <Should Execute Probe Check Bool>
    invoice: <Invoice String>
    network: <Network of Chain Swap String>
  }

  @returns via cbk
  {
    created_at: <Created At ISO 8601 Date String>
    description: <Payment Description String>
    destination_public_key: invoice.destination,
    expires_at: <Expires At ISO 8601 Date String>
    fee: <Swap Fee Tokens Number>
    [fee_fiat_value]: <Fee Fiat Cents Value Number>
    [fiat_currency_code]: <Fiat Currency Code String>
    [fiat_value]: <Fiat Value in Cents Number>
    id: <Invoice Id String>
    is_expired: <Invoice is Expired Bool>
    network: <Network of Invoice String>
    tokens: <Tokens to Send Number>
  }
*/
module.exports = ({cache, check, invoice, network}, cbk) => {
  return asyncAuto({
    // Check arguments
    validate: cbk => {
      if (!cache) {
        return cbk([400, 'ExpectedCacheForInvoiceDetails']);
      }

      if (!invoice) {
        return cbk([400, 'ExpectedInvoiceForInvoiceDetails']);
      }

      if (!network) {
        return cbk([400, 'ExpectedNetworkForInvoiceDetails']);
      }

      return cbk();
    },

    // Determine where the chain tip is at
    getChainTip: ['validate', ({}, cbk) => {
      return getRecentChainTip({network}, cbk);
    }],

    // Get the current fee rate
    getFeeRate: ['validate', ({}, cbk) => {
      return getRecentFeeRate({cache, network}, cbk);
    }],

    // Decode the supplied invoice
    parsedInvoice: ['validate', ({}, cbk) => {
      try {
        return cbk(null, parsePaymentRequest({request: invoice}));
      } catch (err) {
        return cbk([400, 'DecodeInvoiceFailure', err]);
      }
    }],

    // Parameters for a swap with an invoice
    swapParams: ['validate', ({}, cbk) => {
      try {
        return cbk(null, swapParameters({network}));
      } catch (err) {
        return cbk([400, 'ExpectedSwapParameters', err]);
      }
    }],

    // See if there are any swaps already known for this invoice
    getExistingSwaps: ['parsedInvoice', ({parsedInvoice}, cbk) => {
      return getDetectedSwaps({cache, id: parsedInvoice.id}, cbk);
    }],

    // Get the chain tip for the invoice's network
    getInvoiceChainTip: ['parsedInvoice', ({parsedInvoice}, cbk) => {
      return getRecentChainTip({network: parsedInvoice.network}, cbk);
    }],

    // Figure out what it will cost to do this swap
    getSwapFee: ['parsedInvoice', ({parsedInvoice}, cbk) => {
      const to = parsedInvoice.network;
      const {tokens} = parsedInvoice;

      return getFeeForSwap({cache, network, to, tokens}, cbk);
    }],

    // LND connection
    lnd: ['parsedInvoice', ({parsedInvoice}, cbk) => {
      try {
        return cbk(null, lightningDaemon({network: parsedInvoice.network}));
      } catch (err) {
        return cbk([500, 'FailedToInstantiateLndConnection', err, network]);
      }
    }],

    // Check that no swap currently exists for this invoice
    checkNoExistingSwap: ['getExistingSwaps', ({getExistingSwaps}, cbk) => {
      if (!!getExistingSwaps.funding.length) {
        return cbk([409, 'FoundExistingFundingForInvoice']);
      }

      return cbk();
    }],

    // Pull the pending channels to see if we have a related pending channel
    getPending: ['lnd', ({lnd}, cbk) => getPendingChannels({lnd}, cbk)],

    // See if this invoice is payable
    getRoutes: [
      'getSwapFee',
      'lnd',
      'parsedInvoice',
      ({getSwapFee, lnd, parsedInvoice}, cbk) =>
    {
      const net = parsedInvoice.network.toUpperCase();

      return getRoutes({
        lnd,
        cltv_delta: parsedInvoice.cltv_delta,
        destination: parsedInvoice.destination,
        is_adjusted_for_past_failures: true,
        max_fee: getSwapFee.converted_fee,
        routes: parsedInvoice.routes,
        tokens: parsedInvoice.tokens,
      },
      (err, res) => {
        if (!!err) {
          return cbk(err);
        }

        const configuredMaxHops = process.env[`SSS_LN_${net}_MAX_HOPS`];

        const maxHops = parseInt(configuredMaxHops || defaultMaxHops, decBase);

        const routes = res.routes.filter(({hops}) => hops.length <= maxHops);

        return cbk(null, {routes});
      });
    }],

    // Check to make sure the invoice can be paid
    checkPayable: [
      'getChainTip',
      'getFeeRate',
      'getInvoiceChainTip',
      'getPending',
      'getRoutes',
      'getSwapFee',
      'parsedInvoice',
      'swapParams',
      ({
        getChainTip,
        getFeeRate,
        getInvoiceChainTip,
        getPending,
        getRoutes,
        getSwapFee,
        parsedInvoice,
        swapParams,
      },
      cbk) =>
    {
      try {
        const check = checkInvoicePayable({
          network,
          claim_window: swapParams.claim_window,
          current_height: getChainTip.height,
          destination: parsedInvoice.destination,
          destination_height: getInvoiceChainTip.height,
          expires_at: parsedInvoice.expires_at,
          invoice_network: parsedInvoice.network,
          pending_channels: getPending.pending_channels,
          refund_height: getChainTip.height + swapParams.timeout,
          required_confirmations: swapParams.funding_confs,
          routes: getRoutes.routes,
          swap_fee: getSwapFee.fee,
          sweep_fee: getFeeRate.fee_tokens_per_vbyte * estimatedTxVirtualSize,
          tokens: parsedInvoice.tokens,
        });

        return cbk();
      } catch (err) {
        return cbk([400, err.message]);
      }
    }],

    // Execute probe
    probe: [
      'checkPayable',
      'getRoutes',
      'getSwapFee',
      'lnd',
      'parsedInvoice',
      ({getRoutes, getSwapFee, lnd, parsedInvoice}, cbk) =>
    {
      if (!check || !!parsedInvoice.is_expired) {
        return cbk();
      }

      return asyncTimeout(probeForRoute, probeTimeoutMs)({
        lnd,
        cltv_delta: parsedInvoice.cltv_delta,
        destination: parsedInvoice.destination,
        max_fee: getSwapFee.converted_fee,
        probe_timeout_ms: probeTimeoutMs,
        routes: parsedInvoice.routes,
        tokens: parsedInvoice.tokens,
      },
      (err, res) => {
        if (!!err) {
          return cbk([503, 'FailedToExecuteProbe', {err}]);
        }

        if (!res.route) {
          return cbk([400, 'InsufficientCapacityForSwap']);
        }

        return cbk();
      });
    }],

    // Get the exchange rate
    getFiatRate: ['checkPayable', 'parsedInvoice', ({parsedInvoice}, cbk) => {
      const {network} = parsedInvoice;

      return getExchangeRate({cache, network}, cbk);
    }],

    // Get the exchange rate for the fee (may be on a different network)
    getFeeFiatRate: ['checkPayable', ({}, cbk) => {
      return getExchangeRate({cache, network}, cbk);
    }],

    // Fiat value of fee
    feeFiatValue: [
      'getFeeFiatRate',
      'getSwapFee',
      ({getFeeFiatRate, getSwapFee}, cbk) =>
    {
      return cbk(null, getSwapFee.fee * getFeeFiatRate.cents);
    }],

    // Fiat value
    fiatValue: [
      'getFiatRate',
      'parsedInvoice',
      ({getFiatRate, parsedInvoice}, cbk) =>
    {
      return cbk(null, parsedInvoice.tokens * getFiatRate.cents);
    }],

    // Invoice Details
    invoiceDetails: [
      'feeFiatValue',
      'fiatValue',
      'getSwapFee',
      'parsedInvoice',
      ({feeFiatValue, fiatValue, getSwapFee, parsedInvoice}, cbk) =>
    {
      return cbk(null, {
        created_at: parsedInvoice.created_at,
        description: parsedInvoice.description,
        destination_public_key: parsedInvoice.destination,
        expires_at: parsedInvoice.expires_at,
        fee: getSwapFee.fee,
        fee_fiat_value: feeFiatValue,
        fiat_currency_code: fiatCurrency,
        fiat_value: fiatValue || null,
        id: parsedInvoice.id,
        is_expired: parsedInvoice.is_expired,
        network: parsedInvoice.network,
        tokens: parsedInvoice.tokens,
      });
    }],
  },
  returnResult({of: 'invoiceDetails'}, cbk));
};

