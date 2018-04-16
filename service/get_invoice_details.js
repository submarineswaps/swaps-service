const asyncAuto = require('async/auto');
const asyncConstant = require('async/constant');
const {getRoutes} = require('ln-service');
const {parseInvoice} = require('ln-service');

const {getChainFeeRate} = require('./../chain');
const getPrice = require('./get_price');
const {lightningDaemon} = require('./../lightning');
const {returnResult} = require('./../async-util');

const approxTxVSize = 200;

/** Get invoice details

  {
    [max_invoice_fee_rate]: <Max invoice Fee Rate Number>
    invoice: <Invoice String>
  }

  @returns via cbk
  {
    created_at: <Created At ISO 8601 Date String>
    description: <Payment Description String>
    [destination_label]: <Destination Label String>
    destination_public_key: invoice.destination,
    [destination_url]: <Destination Url String>
    expires_at: <Expires At ISO 8601 Date String>
    [fiat_currency_code]: <Fiat Currency Code String>
    [fiat_value]: <Fiat Value in Cents Number>
    id: <Invoice Id String>
    is_expired: <Invoice is Expired Bool>
    network: <Network Name String>
    tokens: <Tokens to Send Number>
  }
*/
module.exports = (args, cbk) => {
  return asyncAuto({
    // Assumed currency code
    currency: asyncConstant('BTC'),

    // Fiat currency
    fiatCurrency: asyncConstant('USD'),

    // Decode the supplied invoice
    invoice: cbk => {
      try {
        return cbk(null, parseInvoice({invoice: args.invoice}));
      } catch (e) {
        return cbk([400, 'DecodeInvoiceFailure', e]);
      }
    },

    // Check that the supplied invoice is payable
    checkInvoice: ['invoice', ({invoice}, cbk) => {
      if (!invoice.tokens) {
        return cbk([400, 'InvoiceMissingTokens']);
      }

      if (!!args.min_tokens && invoice.tokens < args.min_tokens) {
        return cbk([400, 'InvoiceTooSmall']);
      }

      return cbk();
    }],

    // See if this invoice is payable
    getRoutes: ['checkInvoice', ({invoice}, cbk) => {
      try {
        const {destination} = invoice;
        const lnd = lightningDaemon({});
        const {tokens} = invoice;

        return getRoutes({destination, lnd, tokens}, cbk);
      } catch (e) {
        return cbk([500, 'FailedToGetRoutes', e]);
      }
    }],

    // Make sure the routing fee is not too high
    checkRoutingFee: ['getRoutes', 'invoice', ({getRoutes, invoice}, cbk) => {
      const maxFee = Math.max(...getRoutes.routes.map(({fee}) => fee));

      if (!getRoutes.routes.length) {
        return cbk([503, 'InsufficientCapacityForSwap']);
      }

      if (maxFee / invoice.tokens > args.max_invoice_fee_rate) {
        return cbk([503, 'RoutingFeesTooHighToSwap']);
      }

      return cbk();
    }],

    // Get the current chain fees
    chainFee: ['invoice', ({invoice}, cbk) => {
      return getChainFeeRate({network: invoice.network}, cbk);
    }],

    // Make sure the chain fee is not too high
    checkChainFee: ['chainFee', 'invoice', ({chainFee, invoice}, cbk) => {
      const approxFee = chainFee.fee_tokens_per_vbyte * approxTxVSize;

      if (approxFee / invoice.tokens > args.max_invoice_fee_rate) {
        return cbk([503, 'ChainFeesTooHighToSwap']);
      }

      return cbk();
    }],

    // Grab the fiat price
    getPrice: [
      'checkInvoice',
      'currency',
      'fiatCurrency',
      ({currency, fiatCurrency}, cbk) =>
    {
      return getPrice({
        from_currency_code: currency,
        to_currency_code: fiatCurrency,
      },
      cbk);
    }],

    // Fiat value
    fiatValue: ['getPrice', 'invoice', ({getPrice, invoice}, cbk) => {
      if (!getPrice.quote) {
        return cbk();
      }

      return cbk(null, Math.round(getPrice.quote * invoice.tokens / 1e8));
    }],

    // Invoice Details
    invoiceDetails: [
      'currency',
      'fiatCurrency',
      'fiatValue',
      'invoice',
      ({currency, fiatCurrency, fiatValue, invoice}, cbk) =>
    {
      return cbk(null, {
        created_at: invoice.created_at,
        description: invoice.description,
        destination_label: null,
        destination_public_key: invoice.destination,
        destination_url: null,
        expires_at: invoice.expires_at,
        fiat_currency_code: fiatCurrency,
        fiat_value: fiatValue || null,
        id: invoice.id,
        is_expired: invoice.is_expired,
        network: invoice.network,
        tokens: invoice.tokens,
      });
    }],
  },
  returnResult({of: 'invoiceDetails'}, cbk));
};

