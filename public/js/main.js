const App = {
  address_details: {},
  change_events: 'change keyup paste',
  check_for_swap_interval_ms: 5000,
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
App.changedRefundAddress = function(_) {
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

/** Changed the refund script
*/
App.changedRefundScript = function(_) {
  const redeemScript = $(this).val().trim();

  // Exit early when the refund address is blanked
  if (!redeemScript) {
    $('.dump-refund-address').text('');

    return $('.redeem-refund-address, .timeout-block-height').val('');
  }

  const details = blockchain.swapScriptDetails({redeem_script: redeemScript});

  $('.dump-refund-address').text(details.refund_p2wpkh_address);
  $('.timeout-block-height').val(details.timelock_block_height);
  $('.redeem-refund-address').val(details.refund_p2wpkh_address);

  return;
};

/** Check on a swap

  {
    [button]: <Checking Button Dom Object>
    id: <Payment Hash String>
    quote: <Quote Object>
  }
*/
App.checkSwap = ({button, id, quote}) => {
  return App.getSwap({
    destination_public_key: App.swaps[id].destination_public_key,
    invoice: App.swaps[id].invoice,
    payment_hash: App.swaps[id].payment_hash,
    private_key: App.swaps[id].private_key,
    redeem_script: App.swaps[id].redeem_script,
    refund_public_key_hash: App.swaps[id].refund_public_key_hash,
    timeout_block_height: App.swaps[id].timeout_block_height,
  },
  (err, res) => {
    if (!!App.swaps[id].is_completed) {
      return;
    }

    // Reset the check swap button title to its normal state
    if (!!button) {
      $(button).text($(button).prop('title'));
    }

    if (!!err) {
      return;
    }

    quote.find('.chain-link').addClass('disabled');

    const invoice = App.swaps[id].invoice;
    const sentAmount = (res.output_tokens / 1e8).toFixed(8);

    quote.find('.delete-swap').prop('disabled', true).addClass('disabled');
    quote.find('.refund-output-index').val(res.output_index);
    quote.find('.refund-tokens-total').val(sentAmount);
    quote.find('.swap-transaction-id').val(res.transaction_id);

    if (!res.payment_secret) {
      const confs = `${res.conf_wait_count} confirmation`;
      const plural = res.conf_wait_count === 1 ? '' : 's';
      const wait = `Deposit found, waiting for`;

      quote.find('.waiting-notification')
        .removeClass('alert-secondary')
        .addClass('alert-primary');

      quote.find('.waiting-label').text(`${wait} ${confs}${plural}...`);

      return;
    }

    App.swaps[id].is_completed = true;

    return App.presentCompletedSwap({
      invoice,
      payment_secret: res.payment_secret,
      presented_quote: quote,
      swap_amount: App.swaps[id].swap_amount,
      swap_fee: App.swaps[id].swap_fee,
      transaction_id: res.transaction_id,
    });
  });
};

/** Clicked check swap button
*/
App.clickedCheckSwap = function(event) {
  event.preventDefault();

  const button = $(this);

  const quote = button.closest('.swap-quote');

  const id = quote.data().payment_hash;

  button.text(button.data().pending_title);

  return App.checkSwap({button, id, quote});
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
App.clickedNewSwap = function(event) {
  event.preventDefault();

  // Exit early when the swap button is not pressable
  if ($(this).is('.disabled')) {
    return;
  }

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
    swap_amount: <Swap Amount Number>
    swap_p2sh_address: <Swap Chain Legacy P2SH Base58 Address String>
    swap_p2wsh_address: <Swap Chain P2WSH Bech32 Address String>
    timeout_block_height: <Swap Expiration Date Number>
  }
*/
App.createSwap = (args, cbk) => {
  if (!args.currency) {
    return cbk([0, 'ExpectedCurrency']);
  }

  if (!args.invoice) {
    return cbk([0, 'ExpectedInvoice']);
  }

  if (!args.refund_address) {
    return cbk([0, 'ExpectedRefundAddress']);
  }

  const post = {
    currency: args.currency,
    invoice: args.invoice,
    refund_address: args.refund_address,
  };

  App.makeRequest({post, api: 'swaps/'})
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

      if (!details.swap_amount) {
        throw new Error('ExpectedSwapAmount');
      }

      if (!details.swap_p2sh_address) {
        throw new Error('ExpectedSwapP2shAddress');
      }

      if (!details.swap_p2wsh_address) {
        throw new Error('ExpectedSwapP2wshAddress');
      }

      if (!details.timeout_block_height) {
        throw new Error('ExpectedTimeoutBlockHeight');
      }

      return details;
    })
    .then(details => cbk(null, details))
    .catch(err => cbk(err));

  return;
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
  App.makeRequest({api: `address_details/${address}`})
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
    .catch(err => cbk(err));

  return;
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
    .catch(err => {
      switch (err.message) {
      default:
        return cbk(null, err);
      }
    });
};

/** Get the status of a swap

  {
    destination_public_key: <Destination Public Key String>
    invoice: <Invoice BOLT 11 String>
    payment_hash: <Payment Hash String>
    private_key: <Private Key WIF String>
    redeem_script: <Redeem Script String>
    refund_public_key_hash: <Refund Public Key Hash String>
    timeout_block_height: <Timeout Block Height Number>
  }

  @returns via cbk
  {
    [conf_wait_count]: <Confirmations to Wait Number>
    [payment_secret]: <Payment Secret Hex String>
  }
*/
App.getSwap = (args, cbk) => {
  if (!args.destination_public_key) {
    return cbk([0, 'ExpectedDestinationPublicKey']);
  }

  if (!args.invoice) {
    return cbk([0, 'ExpectedInvoice']);
  }

  if (!args.payment_hash) {
    return cbk([0, 'ExpectedPaymentHash']);
  }

  if (!args.private_key) {
    return cbk([0, 'ExpectedPrivateKey']);
  }

  if (!args.redeem_script) {
    return cbk([0, 'ExpectedRedeemScript']);
  }

  if (!args.refund_public_key_hash) {
    return cbk([0, 'ExpectedRefundPublicKeyHash']);
  }

  if (!args.timeout_block_height) {
    return cbk([0, 'ExpectedTimeoutBlockHeight']);
  }

  const post = {
    destination_public_key: args.destination_public_key,
    invoice: args.invoice,
    payment_hash: args.payment_hash,
    private_key: args.private_key,
    redeem_script: args.redeem_script,
    refund_public_key_hash: args.refund_public_key_hash,
    timeout_block_height: args.timeout_block_height,
  };

  App.makeRequest({post, api: `swaps/${args.payment_hash}`})
    .then(details => {
      if (!details.payment_secret && details.conf_wait_count === undefined) {
        throw new Error('ExpectedPaymentSecretOrConfirmationsWaitCount');
      }

      return details;
    })
    .then(details => cbk(null, details))
    .catch(err => cbk(err));

  return;
};

/** Init App
*/
App.init = args => {
  $('.create-swap-quote').submit(App.submitCreateSwapQuote);
  $('.new-swap').click(App.clickedNewSwap);
  $('.online-refund-details').submit(App.submitOnlineRefundRecovery);
  $('.pay-to-lightning-invoice').on(App.change_events, App.changedInvoice);
  $('.refund-address').on(App.change_events, App.changedRefundAddress);
  $('.sign-with-refund-details').submit(App.submitSignWithRefundDetails);
  $('.refund-details-script').on(App.change_events, App.changedRefundScript);
  $('.select-currency').change(App.changedCurrencySelection);

  return;
};

/** Make a request

  {
    api: <API Path String>
    [post]: <Post JSON Object>
  }

  @returns
  <Fetch Promise Object>
*/
App.makeRequest = ({api, post}) => {
  const body = !!post ? JSON.stringify(post) : null;
  const headers = {'content-type': 'application/json'};
  const method = !post ? 'GET' : 'POST';

  return fetch(`/api/v0/${api}`, {body, headers, method})
    .then(r => {
      switch (r.status) {
      case 200:
        return Promise.resolve(r);

      default:
        return Promise.reject(new Error(r.statusText));
      }
    })
    .then(r => r.json());
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

    const addr = `bitcoin:${details.swap_p2wsh_address}?amount=${swapAmount}`;

    quote.data({payment_hash: details.payment_hash});
    quote.find('.chain-link').prop('href', addr);
    quote.find('.redeem-script').val(details.redeem_script);
    quote.find('.swap-address').val(details.swap_p2wsh_address);
    quote.find('.swap-amount').val(swapAmount);
    quote.find('.timeout-block-height').val(details.timeout_block_height);

    quote.find('.save-redeem-script').click(e => {
      const anchor = document.createElement('a');
      const encoding = 'data:text/plain;charset=utf-8';
      const text = [
        'Redeem Script:',
        details.redeem_script,
        '',
        'Swap Address:',
        details.swap_p2wsh_address,
        '',
        'Refund After:',
        details.timeout_block_height,
        '',
        'Swap Amount:',
        swapAmount,
        '',
        'Date:',
        new Date().toISOString()
      ].join('\n');

      anchor.setAttribute('download', `details.swapaddress.redeem_script.txt`);
      anchor.setAttribute('href', `${encoding},${encodeURIComponent(text)}`);

      if (!!document.createEvent) {
        const event = document.createEvent('MouseEvents');

        event.initEvent('click', true, true);
        anchor.dispatchEvent(event);
      } else {
        anchor.click();
      }

      quote.find('.make-payment').collapse('show');
      quote.find('.save-redeem-script').addClass('disabled');
      quote.find('.chain-link').removeClass('disabled');

      return;
    });

    const invoiceDetails = App.invoice_details[invoice];

    App.showInvoice({invoice, swap: quote});

    quote.collapse('show');

    App.check_for_swap = setInterval(() => {
      return App.checkSwap({quote, id: details.payment_hash});
    },
    App.check_for_swap_interval_ms);

    return;
  });
};

/** Submit online refund
*/
App.submitOnlineRefundRecovery = function(event) {
  event.preventDefault();

  $('.refund-details-not-found').collapse('hide');
  $('.search-for-refund').addClass('disabled').prop('disabled', true);
  $('.search-for-refund').text('Searching for Swap Transaction...')

  const redeemScript = $('.online-refund-redeem-script').val().trim();

  if (!redeemScript) {
    return;
  }

  const body = JSON.stringify({redeem_script: redeemScript});
  const headers = {'content-type': 'application/json'};
  const method = 'POST';

  return fetch('/api/v0/swap_outputs/', {body, headers, method})
    .then(r => {
      $('.search-for-refund').removeClass('disabled').prop('disabled', false);
      $('.search-for-refund').text('Search for Refund Details');

      switch (r.status) {
      case 200:
        return Promise.resolve(r);

      default:
        return Promise.reject(new Error(r.statusText));
      }
    })
    .then(r => r.json())
    .then(details => {
      if (!details.fee_tokens_per_vbyte) {
        throw new Error('ExectedFee');
      }

      if (!details.refund_p2wpkh_address) {
        throw new Error('ExpectedRefundAddress');
      }

      if (!details.timelock_block_height) {
        throw new Error('ExpectedLockHeight');
      }

      if (!details.utxo) {
        throw new Error('ExpectedUtxo');
      }

      if (details.utxo.output_index === undefined) {
        throw new Error('ExpectedOutputIndex');
      }

      if (!details.utxo.output_tokens) {
        throw new Error('ExpectedOutputTokens');
      }

      if (!details.utxo.transaction_id) {
        throw new Error('ExpectedTransactionId');
      }

      return details;
    })
    .then(details => {
      $('.refund-details-script').val(redeemScript);
      $('.refund-fee').val(details.fee_tokens_per_vbyte);
      $('.tokens-total').val((details.utxo.output_tokens / 1e8).toFixed(8));
      $('.redeem-refund-address').val(details.refund_p2wpkh_address);
      $('.dump-refund-address').text(details.refund_p2wpkh_address);
      $('.refund-transaction-id').val(details.utxo.transaction_id);
      $('.refund-tx-vout').val(details.utxo.output_index);
      $('.timeout-block-height').val(details.timelock_block_height);

      $('#tx-details-refund-tab').tab('show');

      return;
    })
    .catch(err => {
      switch (err.message) {
      case 'ExectedUtxo':
        $('.refund-details-not-found').collapse('show');
        break;

      default:
        console.log('ERR', err, err.code, err.message);
      }

      return;
    });

  return;
};

/** Submit sign refund transaction with details form
*/
App.submitSignWithRefundDetails = function(e) {
  e.preventDefault();

  const redeemScript = $(this).find('.refund-details-script').val().trim();

  if (!redeemScript) {
    return console.log('ExpectedRedeemScript');
  }

  let swapDetails;

  try {
    swapDetails = blockchain.swapScriptDetails({redeem_script: redeemScript});
  } catch (e) {
    return console.log('FailedToDeriveSwapDetails', e);
  }

  const refundFee = parseInt($('.refund-fee').val().trim(), 10);
  const refundKey = $('.refund-key').val().trim();
  const refundAmount = $('.tokens-total').val().trim();
  const refundTxId = $('.refund-transaction-id').val().trim();
  const refundTxVout = parseInt($('.refund-tx-vout').val().trim(), 10);

  if (!refundKey) {
    $('.signed-refund-transaction').val('');
    $('.generic.refund-tx-failure').collapse('show');

    return;
  }

  const refundTokens = parseInt(
    (parseFloat(refundAmount, 10) * 1e8).toFixed(),
    10
  );

  let refund;

  try {
    refund = blockchain.refundTransaction({
      destination: swapDetails.refund_p2wpkh_address,
      fee_tokens_per_vbyte: refundFee,
      is_public_key_hash_refund: true,
      private_key: refundKey,
      timelock_block_height: swapDetails.timelock_block_height,
      utxos: [{
        redeem: redeemScript,
        tokens: refundTokens,
        transaction_id: refundTxId,
        vout: refundTxVout,
      }],
    });
  } catch (e) {
    $('.signed-refund-transaction').val('');

    switch (e.message) {
    case 'RefundValueTooSmall':
      $('.output-too-small.refund-tx-failure').collapse('show');
      break;

    default:
      $('.generic.refund-tx-failure').collapse('show');
      break;
    }

    return;
  }

  $('.refund-tx-failure').collapse('hide');
  $('.signed-refund-transaction').val(refund.transaction);

  return;
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

  if (!!hasInvoiceDetails && !!swap.find('.refund-address-entry.hide')) {
    swap.find('.refund-address-entry').collapse('show');
  }

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

