const App = {
  address_details: {},
  change_events: 'change keyup paste',
  check_for_swap_interval_ms: 3000,
  check_for_swap_interval: null,
  invoice_details: {},
  swaps: {},
};

/** Changed the currency
*/
App.changedCurrencySelection = function(_) {
  const createSwapQuote = $(this).closest('.create-swap-quote');
  const currencyCode = $(this).val();

  createSwapQuote.find('.address-currency-label').text(currencyCode);

  return;
};

/** Change the invoice

  Update the details of the payment based on the entered invoice.
*/
App.changedInvoice = function(_) {
  const input = $(this);

  const invoice = input.val().trim();
  const swap = input.closest('.create-swap-quote');

  const detailsDisplay = swap.find('.invoice-details');

  // Exit early when the invoice has not changed
  if (swap.data().invoice === invoice) {
    return;
  }

  swap.data({invoice});

  detailsDisplay.collapse('hide');

  // Exit early when the invoice has been removed
  if (!invoice) {
    return input.removeClass('is-invalid').removeClass('is-valid');
  }

  return App.getInvoiceDetails({invoice}, (err, details) => {
    // Exit early when input has changed while the fetch was happening.
    if (input.val().trim() !== invoice) {
      return;
    }

    if (!!err) {
      detailsDisplay.collapse('hide');

      input.toggleClass('is-invalid', err.message === 'InvalidInvoice');

      return;
    }

    App.invoice_details[invoice] = details;

    App.showInvoice({invoice, swap});

    App.updatedSwapDetails({swap});

    return;
  });
};

/** Changed the refund address
*/
App.changedRefundAddress = function(event) {
  const input = $(this);

  const address = input.val().trim();
  const swap = input.closest('.create-swap-quote');

  // Exit early when the address has not changed
  if (swap.data().address === address) {
    return;
  }

  swap.data({address});
  swap.find('.address-currency-label').removeClass('text-danger');
  swap.find('.required-address-type').removeClass('text-danger');

  // Exit early when the invoice has been removed
  if (!address) {
    return input.removeClass('is-invalid').removeClass('is-valid');
  }

  return App.getAddressDetails({address}, (err, details) => {
    if (input.val().trim() !== address) {
      return;
    }

    if (!!err) {
      input.addClass('is-invalid');

      const addrErr = err.message === 'ExpectedPublicKeyHash';
      const netErr = err.message === 'ExpectedTestnetAddress';

      swap.find('.required-address-type').toggleClass('text-danger', addrErr);
      swap.find('.address-currency-label').toggleClass('text-danger', netErr);

      return;
    }

    App.address_details[address] = details;

    App.updatedSwapDetails({swap});

    return;
  });
};

/** Changed the refund key
*/
App.changedRefundKey = function(event) {
  const input = $(this);

  const key = input.val().trim();

  console.log("KEY IS", key);

  return;
};

/** Clicked check swap button
*/
App.clickedCheckSwap = function(event) {
  event.preventDefault();

  const button = $(this);

  const swap = button.closest('.swap-quote');

  const id = swap.data().payment_hash;

  const swapDetails = App.swaps[id];

  button.text('Checking...');

  return App.getSwap({id}, (err, details) => {
    button.text('Check?');

    if (!!err) {
      return console.log('ERROR', err);
    }

    return App.presentCompletedSwap({
      invoice: swapDetails.invoice,
      payment_secret: details.payment_secret,
      presented_quote: swap,
      swap_amount: swapDetails.swap_amount,
      swap_fee: swapDetails.swap_fee,
      transaction_id: details.transaction_id,
    });
  });
};

/** Clicked delete swap
*/
App.clickedDeleteSwap = function(event) {
  event.preventDefault();

  if (!!App.check_for_swap) {
    clearInterval(App.check_for_swap);
  }

  const swap = $(this).closest('.swap-quote');

  swap.remove();

  $('.create-swap-quote').collapse('show');

  return;
};

/** Clicked new swap button
*/
App.clickedNewSwap = e => {
  e.preventDefault();

  $('.create-swap-quote').collapse('show');

  $('.new-swap').addClass('disabled');

  return;
};

/** Clicked show refund pane
*/
App.clickedShowRefund = function(event) {
  event.preventDefault();

  const swap = $(this).closest('.swap-quote');

  swap.find('.toggle-refund').removeClass('active').removeClass('inactive');

  $(this).addClass('active');

  swap.find('.send-to-swap').collapse('hide');
  swap.find('.refund-details').collapse('show');

  return;
};

/** Clicked show swap
*/
App.clickedShowSwap = function(event) {
  event.preventDefault();

  const swap = $(this).closest('.swap-quote');

  swap.find('.toggle-refund').removeClass('active').removeClass('inactive');

  $(this).addClass('active');

  swap.find('.send-to-swap').collapse('show');
  swap.find('.refund-details').collapse('hide');

  return;
};

/** Create swap

  {
    currency: <Currency Code String>
    invoice: <Bolt 11 Invoice String>
    refund_address: <Refund Address String>
  }

  @returns via cbk
  {
    destination_public_key: <Destination Public Key Hex String>
    invoice: <Lightning Invoice String>
    payment_hash: <Payment Hash Hex String>
    private_key: <Private Key WIF String>
    refund_address: <Refund Address String>
    refund_public_key_hash: <Refund Public Key Hash Hex String>
    redeem_script: <Redeem Script Hex String>
    swap_address: <Swap Chain Address String>
    swap_amount: <Swap Amount Number>
    timeout_block_height: <Swap Expiration Date Number>
  }
*/
App.createSwap = (args, cbk) => {
  const body = JSON.stringify({
    currency: args.currency,
    invoice: args.invoice,
    refund_address: args.refund_address,
  });

  const headers = {'content-type': 'application/json'};
  const method = 'POST';

  return fetch('/api/v0/swaps/', {body, headers, method})
    .then(r => {
      switch (r.status) {
      case 200:
        return Promise.resolve(r);

      default:
        return Promise.reject(new Error(r.statusText));
      }
    })
    .then(r => r.json())
    .then(details => {
      if (!App.invoice_details[args.invoice]) {
        throw new Error('ExpectedInvoiceDetails');
      }

      if (!details.refund_address) {
        throw new Error('ExpectedRefundAddress');
      }

      if (!details.redeem_script) {
        throw new Error('ExpectedRedeemScript');
      }

      if (!details.swap_address) {
        throw new Error('ExpectedSwapAddress');
      }

      if (!details.swap_amount) {
        throw new Error('ExpectedSwapAmount');
      }

      if (!details.timeout_block_height) {
        throw new Error('ExpectedTimeoutBlockHeight');
      }

      return details;
    })
    .then(details => cbk(null, details))
    .catch(err => cbk(err));
};

/** Format tokens as a display string

  {
    tokens: <Tokens Number>
  }
*/
App.format = ({tokens}) => {
  const bigUnitDivisibility = 8;
  const tokensPerBigUnit = 1e8;

  return (tokens / tokensPerBigUnit).toFixed(bigUnitDivisibility);
};

/** Get address details

  {
    address: <Chain Address String>
  }

  @returns via cbk
  {
    is_testnet: <Is Testnet Address Bool>
    type: <Address Type String>
  }
*/
App.getAddressDetails = ({address}, cbk) => {
  return fetch(`/api/v0/address_details/${address}`)
    .then(r => {
      switch (r.status) {
      case 200:
        return Promise.resolve(r);

      default:
        return Promise.reject(new Error(r.statusText));
      }
    })
    .then(r => r.json())
    .then(details => {
      if (details.is_testnet !== true) {
        throw new Error('ExpectedTestnetAddress');
      }

      if (details.type !== 'p2pkh' && details.type !== 'p2wpkh') {
        throw new Error('ExpectedPublicKeyHash');
      }

      return details
    })
    .then(details => cbk(null, details))
    .catch(err => cbk(err))
};

/** Get invoice details

  {
    invoice: <Bolt 11 Invoice String>
  }

  @returns via cbk
  {
    created_at: <Created At ISO 8601 Date String>
    currency: <Currency Code String>
    description: <Payment Description String>
    [destination_label]: <Destination Label String>
    [destination_url]: <Destination Url String>
    [expires_at]: <Expires At ISO 8601 Date String>
    [fiat_currency_code]: <Fiat Currency Code String>
    [fiat_value]: <Fiat Value in Cents Number>
    id: <Invoice Id String>
    is_testnet: <Is Testnet Bool>
    tokens: <Tokens to Send Number>
  }
*/
App.getInvoiceDetails = ({invoice}, cbk) => {
  return fetch(`/api/v0/invoice_details/${invoice}`)
    .then(r => {
      switch (r.status) {
      case 200:
        return Promise.resolve(r);

      case 400:
        return Promise.reject(new Error('InvalidInvoice'));

      default:
        return Promise.reject(new Error(r.statusText));
      }
    })
    .then(r => r.json())
    .then(details => {
      if (!details.created_at) {
        throw new Error('ExpectedCreatedAt');
      }

      if (!details.currency) {
        throw new Error('ExpectedCurrency');
      }

      if (typeof details.description !== 'string') {
        throw new Error('ExpectedDescription');
      }

      if (!details.id) {
        throw new Error('ExpectedId');
      }

      if (details.is_testnet === undefined) {
        throw new Error('ExpectedIsTestnet');
      }

      if (!details.tokens) {
        throw new Error('ExpectedTokens');
      }

      return details;
    })
    .then(details => cbk(null, details))
    .catch(err => cbk(err));
};

/** Get refund details

  {
    id: <Invoice Id String>
  }

  @returns via cbk
  {
    current_block_height: <Current Block Height Number>
    destination: <Send Tokens to Address String>
    fee_tokens_per_vbyte: <Fee Per Virtual Byte Token Rate Number>
    utxos: [{
      redeem: <Redeem Script Buffer>
      tokens: <Tokens Number>
      transaction_id: <Transaction Id String>
      vout: <Vout Number>
    }]
  }
*/
App.getRefundDetails = ({id}, cbk) => {
  const swapDetails = App.swaps[id];

  const body = JSON.stringify({
    destination_public_key: swapDetails.destination_public_key,
    payment_hash: swapDetails.payment_hash,
    redeem_script: swapDetails.redeem_script,
    refund_address: swapDetails.refund_address,
    timeout_block_height: swapDetails.timeout_block_height,
  });

  const headers = {'content-type': 'application/json'};
  const method = 'POST';

  return fetch('/api/v0/refunds/', {body, headers, method})
    .then(r => {
      switch (r.status) {
      case 200:
        return Promise.resolve(r);

      default:
        return Promise.reject(new Error(r.statusText));
      }
    })
    .then(r => r.json())
    .then(details => {
      if (!details.current_block_height) {
        throw new Error('ExpectedCurrentBlockHeight');
      }

      if (!details.destination) {
        throw new Error('ExpectedDestination');
      }

      if (!details.fee_tokens_per_vbyte) {
        throw new Error('ExpectedFee');
      }

      if (!Array.isArray(details.utxos)) {
        throw new Error('ExpectedUtxos');
      }

      return details;
    })
    .then(details => cbk(null, details))
    .catch(err => cbk(err));
};

/** Get the status of a swap

  {
    id: <Invoice Id String>
  }

  @returns via cbk
  {
    [conf_wait_count]: <Confirmations to Wait Number>
    [payment_secret]: <Payment Secret Hex String>
  }
*/
App.getSwap = ({id}, cbk) => {
  const swapDetails = App.swaps[id];

  const body = JSON.stringify({
    destination_public_key: swapDetails.destination_public_key,
    invoice: swapDetails.invoice,
    payment_hash: swapDetails.payment_hash,
    private_key: swapDetails.private_key,
    redeem_script: swapDetails.redeem_script,
    refund_public_key_hash: swapDetails.refund_public_key_hash,
    timeout_block_height: swapDetails.timeout_block_height,
  });

  const headers = {'content-type': 'application/json'};
  const method = 'POST';

  return fetch(`/api/v0/swaps/${id}`, {body, headers, method})
    .then(r => {
      switch (r.status) {
      case 200:
        return Promise.resolve(r);

      default:
        return Promise.reject(new Error(r.statusText));
      }
    })
    .then(r => r.json())
    .then(details => {
      if (!details.payment_secret && details.conf_wait_count === undefined) {
        throw new Error('ExpectedPaymentSecretOrConfirmationsWaitCount');
      }

      return details;
    })
    .then(details => cbk(null, details))
    .catch(err => cbk(err));
};

/** Init App
*/
App.init = args => {
  $('.create-swap-quote').submit(App.submitCreateSwapQuote);
  $('.new-swap').click(App.clickedNewSwap);
  $('.pay-to-lightning-invoice').on(App.change_events, App.changedInvoice);
  $('.refund-address').on(App.change_events, App.changedRefundAddress);
  $('.select-currency').change(App.changedCurrencySelection);

  return;
};

/** Present completed swap

  {
    invoice: <Bolt 11 Invoice String>
    payment_secret: <Payment Secret String>
    presented_quote: <Presented Quote DOM Object>
    swap_amount: <On-Chain Swap Amount Tokens Number>
    swap_fee: <Swap Fee Tokens Number>
    transaction_id: <Transaction Id String>
  }
*/
App.presentCompletedSwap = args => {
  if (!!App.check_for_swap) {
    clearInterval(App.check_for_swap);
  }

  args.presented_quote.remove();

  const swap = $('.swap-success').clone();

  const href = `https://testnet.smartbit.com.au/tx/${args.transaction_id}`;

  App.showInvoice({swap, invoice: args.invoice});

  swap.addClass('presented').removeClass('template');
  swap.find('.chain-amount').text(App.format({tokens: args.swap_amount}));
  swap.find('.payment-secret').text(args.payment_secret);
  swap.find('.swap-date').text(new Intl.DateTimeFormat().format(new Date()));
  swap.find('.swap-fee').text(App.format({tokens: args.swap_fee}));
  swap.find('.transaction-id').text(args.transaction_id);
  swap.find('.transaction-id').prop('href', href);

  $('.quotes').prepend(swap);

  swap.collapse('show');

  $('.new-swap').removeClass('disabled');

  return;
};

/** Show invoice

  {
    invoice: <Lightning Invoice String>
    swap: <Swap DOM Object>
  }
*/
App.showInvoice = args => {
  const cents = 100;
  const details = args.swap.find('.invoice-details');
  const invoice = App.invoice_details[args.invoice];

  const currencyFormatter = new Intl.NumberFormat('en-US', {
    currency: invoice.fiat_currency_code,
    style: 'currency',
  });

  const fiat = invoice.fiat_value / cents;
  const hasDestinationUrl = !!invoice.destination_url;
  const isTestnet = invoice.is_testnet;

  details.find('.destination-url').prop('href', invoice.destination_url);
  details.find('.destination-url').text(invoice.destination_label);
  details.find('.destination-url').prop('hidden', !hasDestinationUrl);
  details.find('.payment-public-key').text(invoice.destination_public_key);
  details.find('.payment-public-key').prop('hidden', !!hasDestinationUrl);
  details.find('.fiat-currency-code').text(invoice.fiat_currency_code);
  details.find('.fiat-send-amount').text(currencyFormatter.format(fiat));
  details.find('.description').prop('hidden', !invoice.description);
  details.find('.payment-description').text(invoice.description);
  details.find('.send-amount').text(App.format({tokens: invoice.tokens}));
  details.find('.send-currency-code').text(invoice.currency);
  details.find('.testnet-currency-qualifier').prop('hidden', !isTestnet);

  details.collapse('show');

  return;
};

/** Submit the create swap quote form
*/
App.submitCreateSwapQuote = function(event) {
  event.preventDefault();

  const swap = $(this).closest('.create-swap-quote');

  const addressInput = swap.find('.refund-address');
  const invoiceInput = swap.find('.pay-to-lightning-invoice');

  const address = addressInput.val().trim();
  const invoice = invoiceInput.val().trim();

  if (!App.address_details[address] || !App.invoice_details[invoice]) {
    return;
  }

  swap.collapse('hide');

  const quote = $('.swap-quote').clone();

  quote.addClass('presented').removeClass('template');

  quote.find('.check-swap').click(App.clickedCheckSwap);
  quote.find('.delete-swap').click(App.clickedDeleteSwap);
  quote.find('.refund-key').on(App.change_events, App.changedRefundKey);
  quote.find('.show-payment').click(App.clickedShowSwap);
  quote.find('.show-refund').click(App.clickedShowRefund);

  $('.quotes').prepend(quote);

  return App.createSwap({
    invoice,
    currency: 'tBTC',
    refund_address: address,
  },
  (err, details) => {
    if (!!err) {
      return console.log('CREATE SWAP FAILURE', err);
    }

    swap.find('.invoice-details').collapse('hide');

    addressInput.removeClass('is-valid').val('');
    invoiceInput.removeClass('is-valid').val('');

    App.swaps[details.payment_hash] = details;

    const swapAmount = App.format({tokens: details.swap_amount});

    const addr = `bitcoin:${details.swap_address}?amount=${swapAmount}`;

    quote.data({payment_hash: details.payment_hash});
    quote.find('.chain-link').prop('href', addr);
    quote.find('.redeem-script').val(details.redeem_script);
    quote.find('.swap-address').val(details.swap_address);
    quote.find('.swap-amount').val(swapAmount);
    quote.find('.timeout-block-height').text(details.timeout_block_height);

    const invoiceDetails = App.invoice_details[invoice];

    App.showInvoice({invoice, swap: quote});

    quote.collapse('show');

    App.check_for_swap = setInterval(() => {
      return App.getSwap({id: details.payment_hash}, (err, res) => {
        if (!!err) {
          return;
        }

        App.getRefundDetails({id: details.payment_hash}, (err, refund) => {
          if (!!err) {
            return console.log("REFUND ERR", err);
          }

          quote.data({refund});

          const {transaction} = blockchain.refundTransaction({
            current_block_height: details.timeout_block_height,
            destination: refund.destination,
            fee_tokens_per_vbyte: refund.fee_tokens_per_vbyte,
            is_public_key_hash_refund: true,
            private_key: quote.find('.refund-key').val().trim(),
            utxos: refund.utxos,
          });

          quote.find('.refund-transaction').val(transaction)

          return;
        });

        if (!res.payment_secret) {
          const wait = `Deposit found, waiting for`;
          const confs = `${res.conf_wait_count} confirmation`;
          const plural = res.conf_wait_count === 1 ? '' : 's';

          quote.find('.waiting-label').text(`${wait} ${confs}${plural}...`);

          return;
        }

        return App.presentCompletedSwap({
          invoice,
          payment_secret: res.payment_secret,
          presented_quote: quote,
          swap_amount: details.swap_amount,
          swap_fee: details.swap_fee,
          transaction_id: res.transaction_id,
        });
      });
    },
    App.check_for_swap_interval_ms);

    return;
  });
};

/** Update the swap details

  {
    swap: <Swap DOM Object>
  }
*/
App.updatedSwapDetails = ({swap}) => {
  const address = swap.find('.refund-address').val().trim();
  const invoice = swap.find('.pay-to-lightning-invoice').val().trim();

  const hasAddress = !!App.address_details[address];
  const hasInvoiceDetails = !!App.invoice_details[invoice];

  if (!!hasAddress) {
    swap.find('.refund-address')
      .addClass('is-valid')
      .removeClass('is-invalid');
  }

  swap.find('.pay-to-lightning-invoice')
    .toggleClass('is-valid', !!hasInvoiceDetails)
    .toggleClass('is-invalid', !hasInvoiceDetails && !!invoice);

  const isReady = !!hasAddress && !!hasInvoiceDetails;

  swap.find('.make').toggleClass('disabled', !isReady);

  return;
};

$(() => App.init({}));

