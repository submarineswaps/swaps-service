const App = {
  address_details: {},
  change_events: 'change keyup paste',
  check_for_swap_interval_ms: 3000,
  check_for_swap_interval: null,
  grace_ms: 1800 * 1e3,
  invoice_details: {},
  invoice_refund_keypairs: {},
  rates: {},
  swaps: {},
};

/** Changed the currency
*/
App.changedCurrencySelection = function({}) {
  const swap = $(this).closest('.create-swap-quote');

  if (!swap) {
    return;
  }

  const network = $(this).val();

  const iconToShow = `.icon-${network}`;

  swap.find('.coin-icon').prop('hidden', true);

  swap.find(iconToShow).removeAttr('hidden');

  App.updateInvoiceDetails({swap});

  return;
};

/** Change the invoice

  Update the details of the payment based on the entered invoice.
*/
App.changedInvoice = function({}) {
  const swap = $(this).closest('.create-swap-quote');

  App.updateInvoiceDetails({swap});

  return;
};

/** Changed the refund address
*/
App.changedRefundAddress = function({}) {
  const input = $(this);

  const address = input.val().trim();
  const swap = input.closest('.create-swap-quote');

  // Exit early when the address has not changed
  if (!swap.data() || swap.data().address === address) {
    return;
  }

  swap.data({address});
  swap.find('.address-currency-label').removeClass('text-danger');
  swap.find('.required-address-type').removeClass('text-danger');

  // Exit early when the invoice has been removed
  if (!address) {
    return input.removeClass('is-invalid').removeClass('is-valid');
  }

  const network = swap.find('.select-currency').val();

  return App.getAddressDetails({address, network}, (err, details) => {
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

/** Changed refund key generation preference
*/
App.changedRefundPreference = function({}) {
  const swap = $(this).closest('.create-swap-quote');

  const isPaperWallet = !!$(this).is(':checked');

  swap.find('.paper-wallet-label').toggleClass('text-muted', !isPaperWallet);
  swap.find('.refund-address-entry').prop('hidden', isPaperWallet);

  if (isPaperWallet) {
    swap.find('.refund-address').removeAttr('required');
  } else {
    swap.find('.refund-address').prop('required', true);
  }

  App.updatedSwapDetails({swap});

  return;
};

/** Changed the refund script
*/
App.changedRefundScript = function({}) {
  const script = $(this).val().trim();

  const network = $('.select-currency').val();

  // Exit early when the refund address is blanked
  if (!script) {
    $('.dump-refund-address').text('');

    return $('.redeem-refund-address, .timeout-block-height').val('');
  }

  const details = blockchain.swapScriptDetails({network, script});

  $('.dump-refund-address').text(details.refund_p2wpkh_address);
  $('.timeout-block-height').val(details.timelock_block_height);
  $('.redeem-refund-address').val(details.refund_p2wpkh_address);
  $('.refund-p2sh-p2wsh-swap-address').text(details.p2sh_p2wsh_address);
  $('.refund-p2sh-swap-address').text(details.p2sh_address);
  $('.refund-p2wsh-swap-address').text(details.p2wsh_address);

  if (!!details.bch_p2sh_address && !!details.p2sh_output_script) {
    $('.bch-p2sh-address').prop('value', details.bch_p2sh_address);
    $('.bch-p2sh-address').text(details.bch_p2sh_address);

    $('.select-swap-address').data(
      details.bch_p2sh_address,
      details.p2sh_output_script
    );
  } else {
    $('.bch-p2sh-address').prop('hidden', true);
  }

  $('.p2sh-address').prop('value', details.p2sh_address);
  $('.p2sh-address').text(details.p2sh_address);

  $('.select-swap-address').data(
    details.p2sh_address,
    details.p2sh_output_script
  );

  if (!!details.p2sh_p2wsh_address && !!details.p2sh_p2wsh_output_script) {
    $('.p2sh-p2wsh-address').prop('value', details.p2sh_p2wsh_address);
    $('.p2sh-p2wsh-address').text(details.p2sh_p2wsh_address);

    $('.select-swap-address').data(
      details.p2sh_p2wsh_address,
      details.p2sh_p2wsh_output_script
    );
  } else {
    $('.p2sh-p2wsh-address').prop('hidden', true);
  }

  if (!!details.p2wsh_address && !!details.p2wsh_output_script) {
    $('.p2wsh-address').prop('value', details.p2wsh_address);
    $('.p2wsh-address').text(details.p2wsh_address);

    $('.select-swap-address').data(
      details.p2wsh_address,
      details.p2wsh_output_script
    );
  } else {
    $('.p2wsh-address').prop('hidden', true);
  }

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
  const {network} = App.swaps[id];

  return App.getSwap({
    network,
    invoice: App.swaps[id].invoice,
    redeem_script: App.swaps[id].redeem_script,
    swap_key_index: App.swaps[id].swap_key_index,
  },
  (err, res) => {
    if (!!err && err.message === 'Gone') {
      quote.find('.failure').collapse('show');

      return;
    }

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
    let txUrl = '#';

    quote.find('.delete-swap').prop('disabled', true).addClass('disabled');
    quote.find('.download-file .label').text('Save Full Refund Details');
    quote.find('.refund-output-index').val(res.output_index);
    quote.find('.refund-tokens-total').val(sentAmount);
    quote.find('.swap-transaction-id').val(res.transaction_id);

    App.swaps[id].transaction_id = res.transaction_id;
    App.swaps[id].transaction_output_index = res.output_index;

    switch (network) {
    case 'bchtestnet':
      txUrl = `https://www.blocktrail.com/tBCC/tx/${res.transaction_id}`;
      break;

    case 'testnet':
      txUrl = `https://testnet.smartbit.com.au/tx/${res.transaction_id}`;
      break;

    case 'ltctestnet':
      txUrl = `https://chain.so/tx/LTCTEST/${res.transaction_id}`;
      break;

    default:
      console.log([0, 'ExpectedTxUrl']);
      break;
    }

    // Exit early when the deposit is found but more confs are needed
    if (!res.payment_secret) {
      // Display min 1 block waiting, since 0 blocks means swap is happening
      const confCount = res.conf_wait_count || 1;

      const isPluralConfs = confCount !== 1;

      quote.find('.found-waiting').collapse('show');
      quote.find('.deposit-transaction-id').prop('href', txUrl);
      quote.find('.needed-confirmations-count').text(confCount);
      quote.find('.plural-confirmation').prop('hidden', !isPluralConfs);
      quote.find('.tx-found').collapse('show');
      quote.find('.waiting-label').collapse('hide');
      quote.find('.qr-code').hide()

      quote.find('.waiting-notification')
        .removeClass('alert-secondary')
        .addClass('alert-primary');

      quote.find('.swap-payment-details').hide();

      return;
    }

    App.swaps[id].is_completed = true;

    return App.presentCompletedSwap({
      invoice,
      network: App.swaps[id].network,
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
  $('.presented.swap-success').remove();

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
    invoice: <Bolt 11 Invoice String>
    network: <Network Name String>
    refund: <Refund Address String>
  }

  @returns via cbk
  {
    destination_public_key: <Destination Public Key Hex String>
    fee_tokens_per_vbyte: <Fee Rate Tokens Per Virtual Byte Number>
    invoice: <Lightning Invoice String>
    payment_hash: <Payment Hash Hex String>
    redeem_script: <Redeem Script Hex String>
    refund_address: <Refund Address String>
    refund_public_key_hash: <Refund Public Key Hash Hex String>
    swap_amount: <Swap Amount Number>
    swap_fee: <Swap Fee Tokens Number>
    swap_key_index: <Swap Key Index Number>
    swap_p2sh_address: <Swap Chain Legacy P2SH Base58 Address String>
    swap_p2sh_p2wsh_address: <Swap Chain P2SH Nested SegWit Address String>
    swap_p2wsh_address: <Swap Chain P2WSH Bech32 Address String>
    timeout_block_height: <Swap Expiration Date Number>
  }
*/
App.createSwap = ({invoice, network, refund}, cbk) => {
  if (!invoice) {
    return cbk([0, 'ExpectedInvoice']);
  }

  if (!network) {
    return cbk([0, 'ExpectedNetwork']);
  }

  if (!refund) {
    return cbk([0, 'ExpectedRefundAddress']);
  }

  App.makeRequest({post: {invoice, network, refund}, api: 'swaps/'})
    .then(details => {
      if (!App.invoice_details[invoice]) {
        throw new Error('ExpectedInvoiceDetails');
      }

      if (!details.destination_public_key) {
        throw new Error('ExpectedDestinationPublicKey');
      }

      if (!details.fee_tokens_per_vbyte) {
        throw new Error('ExpectedFeeTokensPerVirtualByte');
      }

      if (!details.invoice) {
        throw new Error('ExpectedInvoice');
      }

      if (!details.payment_hash) {
        throw new Error('ExpectedPaymentHash');
      }

      if (!details.refund_address) {
        throw new Error('ExpectedRefundAddress');
      }

      if (!details.refund_public_key_hash) {
        throw new Error('ExpectedRefundPublicKeyHash');
      }

      if (!details.redeem_script) {
        throw new Error('ExpectedRedeemScript');
      }

      if (!details.swap_amount) {
        throw new Error('ExpectedSwapAmount');
      }

      if (!details.swap_fee) {
        throw new Error('ExpectedSwapFee');
      }

      if (!details.swap_key_index) {
        throw new Error('ExpectedSwapKeyIndex');
      }

      if (!details.swap_p2sh_address) {
        throw new Error('ExpectedSwapP2shAddress');
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
    type: <Address Type String>
  }
*/
App.getAddressDetails = ({address, network}, cbk) => {
  App.makeRequest({api: `address_details/${network}/${address}`})
    .then(details => {
      if (details.type !== 'p2pkh' && details.type !== 'p2wpkh') {
        throw new Error('ExpectedPublicKeyHash');
      }

      return details
    })
    .then(details => cbk(null, details))
    .catch(err => cbk(err));

  return;
};

/** Get invoice details in the context of a swap

  {
    invoice: <Bolt 11 Invoice String>
    network: <Swapping with Network Name String>
  }

  @returns via cbk
  {
    created_at: <Created At ISO 8601 Date String>
    description: <Payment Description String>
    destination_public_key: <Destination Public Key Hex String>
    [expires_at]: <Expires At ISO 8601 Date String>
    fee: <Fee Tokens Number>
    [fee_fiat_value]: <Fee Fiat Value in Cents Number>
    [fiat_currency_code]: <Fiat Currency Code String>
    [fiat_value]: <Fiat Value in Cents Number>
    id: <Invoice Id String>
    network: <Network Name String>
    tokens: <Tokens to Send Number>
  }
*/
App.getInvoiceDetails = ({invoice, network}, cbk) => {
  return fetch(`/api/v0/invoice_details/${network}/${invoice}`)
    .then(r => {
      switch (r.status) {
      case 200:
        return Promise.resolve(r);

      default:
        return Promise.reject(r);
      }
    })
    .then(r => r.json())
    .then(details => {
      if (!details.created_at) {
        throw new Error('ExpectedCreatedAt');
      }

      if (typeof details.description !== 'string') {
        throw new Error('ExpectedDescription');
      }

      if (!details.destination_public_key) {
        throw new Error('ExpectedDestinationPublicKey');
      }

      if (!details.expires_at) {
        throw new Error('ExpectedExpiresAt');
      }

      if (details.fee === undefined) {
        throw new Error('ExpectedFeeTokensAmount');
      }

      if (!details.id) {
        throw new Error('ExpectedId');
      }

      if (details.is_expired !== false) {
        throw new Error('ExpectedUnexpiredInvoice');
      }

      if (details.network !== 'testnet') {
        throw new Error('ExpectedIsTestnet');
      }

      if (!details.tokens) {
        throw new Error('ExpectedTokens');
      }

      return details;
    })
    .then(details => cbk(null, {
      created_at: details.created_at,
      description: details.description,
      destination_public_key: details.destination_public_key,
      expires_at: details.expires_at,
      fee: details.fee,
      fee_fiat_value: details.fee_fiat_value || null,
      fiat_currency_code: details.fiat_currency_code,
      fiat_value: details.fiat_value || null,
      id: details.id,
      is_expired: details.is_expired,
      network: details.network,
      tokens: details.tokens,
    }))
    .catch(err => {
      if (!!err.text) {
        return err.text().then(text => cbk([err.status, text]));
      }

      return cbk([500, err.message]);
    });
};

/** Get the status of a swap

  {
    invoice: <Invoice BOLT 11 String>
    network: <Network Name String>
    redeem_script: <Redeem Script String>
  }

  @returns via cbk
  {
    [conf_wait_count]: <Confirmations to Wait Number>
    [payment_secret]: <Payment Secret Hex String>
    [transaction_id]: <Transaction Id Hex String>
  }
*/
App.getSwap = (args, cbk) => {
  if (!args.invoice) {
    return cbk([0, 'ExpectedInvoice']);
  }

  if (!args.redeem_script) {
    return cbk([0, 'ExpectedRedeemScript']);
  }

  const post = {
    invoice: args.invoice,
    network: args.network,
    redeem_script: args.redeem_script,
  };

  App.makeRequest({post, api: `swaps/check`})
    .then(details => cbk(null, details))
    .catch(err => cbk(err));

  return;
};

/** Init App
*/
App.init = args => {
  $('.create-swap-quote').submit(App.submitCreateSwapQuote);
  $('.enter-refund-details').submit(App.submitRefundRecovery);
  $('.new-swap').click(App.clickedNewSwap);
  $('.pay-to-lightning-invoice').on(App.change_events, App.changedInvoice);
  $('.refund-address').on(App.change_events, App.changedRefundAddress);
  $('.select-currency').prop('disabled', false);
  $('.sign-with-refund-details').submit(App.submitSignWithRefundDetails);
  $('.refund-details-script').on(App.change_events, App.changedRefundScript);
  $('.create-swap-quote .select-currency').change(App.changedCurrencySelection);
  $('#use-paper-wallet').change(App.changedRefundPreference);
  $('.pay-to-lightning-invoice').prop('readonly', false);

  App.initExchangeRates({}, (err, res) => {
    if (!!err) {
      return console.log(err);
    }

    res.rates.forEach(({cents, fees, network}) => {
      return App.rates[network] = {cents, fees};
    });

    App.updatedSwapDetails({swap: $('.create-swap-quote')});

    return;
  });

  return;
};

/** Initialize exchange rates

  {}

  @returns via cbk
  {
    rates: [{
      cents: <Cents Per Token Number>
      network: <Network Name String>
    }]
  }
*/
App.initExchangeRates = ({}, cbk) => {
  App.makeRequest({api: 'exchange_rates/'})
    .then(res => {
      if (!res || !Array.isArray(res.rates)) {
        throw new Error('ExpectedExchangeRates');
      }

      return res.rates;
    })
    .then(rates => cbk(null, {rates}))
    .catch(err => cbk(err));

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
    network: <Chain Network Name String>
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

  let href = '#';
  let onChainCurrency = '';
  const swap = $('.swap-success').clone();

  swap.addClass('presented').removeClass('template');

  switch (args.network) {
  case 'bchtestnet':
    href = `https://www.blocktrail.com/tBCC/tx/${args.transaction_id}`;
    onChainCurrency = 'tBCH';
    break;

  case 'testnet':
    href = `https://testnet.smartbit.com.au/tx/${args.transaction_id}`;
    onChainCurrency = 'tBTC';
    break;

  case 'ltctestnet':
    href = `https://chain.so/tx/LTCTEST/${args.transaction_id}`;
    onChainCurrency = 'tLTC';
    break;

  default:
    console.log([0, 'UnexpectedNetworkForHref']);
    break;
  }

  swap.find('.chain-amount').text(App.format({tokens: args.swap_amount}));
  swap.find('.payment-secret').text(args.payment_secret);
  swap.find('.send-network-code').text(onChainCurrency);
  swap.find('.swap-date').text(new Intl.DateTimeFormat().format(new Date()));
  swap.find('.swap-fee').text(App.format({tokens: args.swap_fee}));
  swap.find('.transaction-id').text(args.transaction_id);
  swap.find('.transaction-id').prop('href', href);

  $('.quotes').prepend(swap);

  swap.collapse('show');

  App.showInvoice({swap, invoice: args.invoice});

  $('.new-swap').removeClass('disabled');

  return;
};

/** Get qr code

  {
    address: <Address String>
    amount: <Amount String>
    scheme: <Scheme String>
  }

  @returns
  <QR Code Img Object>
*/
App.qrCode = ({address, amount, scheme}) => {
  const addressLink = `${scheme}:${address}?amount=${amount}`;
  const back = 'rgb(250, 250, 250)';
  const rounded = 100;
  const size = 300;

  const qr = kjua({back, rounded, size, text: addressLink});

  $(qr).css({height: 'auto', 'max-width': '160px', width: '100%'});

  return qr;
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

  let symbolForFiat;
  let symbolForNetwork;

  switch (invoice.network) {
  case 'ltctestnet':
    symbolForFiat = 'tUSD';
    symbolForNetwork = 'Lightning tLTC';

  case 'testnet':
    symbolForFiat = 'tUSD';
    symbolForNetwork = 'Lightning tBTC';
    break;

  case 'bitcoin':
    symbolForFiat = 'USD';
    symbolForNetwork = 'Lightning BTC';
    break;

  default:
    symbolForNetwork = '';
    symbolForNetwork = '';
    break;
  }

  details.find('.destination-url').prop('href', invoice.destination_url);
  details.find('.destination-url').text(invoice.destination_label);
  details.find('.destination-url').prop('hidden', !hasDestinationUrl);
  details.find('.payment-public-key').text(invoice.destination_public_key);
  details.find('.payment-public-key').prop('hidden', !!hasDestinationUrl);
  details.find('.fiat-currency-code').text(symbolForFiat);
  details.find('.fiat-send-amount').text(currencyFormatter.format(fiat));
  details.find('.description').prop('hidden', !invoice.description);
  details.find('.payment-description').text(invoice.description);
  details.find('.send-amount').text(App.format({tokens: invoice.tokens}));
  details.find('.send-currency-code').text(symbolForNetwork);

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
  const isPaperWallet = !!swap.find('#use-paper-wallet').is(':checked');

  const address = addressInput.val().trim();
  const invoice = invoiceInput.val().trim();
  const network = swap.find('.select-currency').val();

  if (!App.invoice_details[invoice]) {
    return;
  }

  if (!isPaperWallet && !App.address_details[address]) {
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

  const refundKey = App.invoice_refund_keypairs[invoice];

  const refund = !isPaperWallet ? address : refundKey.p2pkh_address;

  return App.createSwap({invoice, network, refund}, (err, details) => {
    if (!!err) {
      return console.log('CREATE SWAP FAILURE', err);
    }

    swap.find('.invoice-details').collapse('hide');

    addressInput.removeClass('is-valid').val('');
    invoiceInput.removeClass('is-valid').val('');

    App.swaps[details.payment_hash] = {
      network,
      destination_public_key: details.destination_public_key,
      fee_tokens_per_vbyte: details.fee_tokens_per_vbyte,
      invoice: details.invoice,
      payment_hash: details.payment_hash,
      redeem_script: details.redeem_script,
      refund_address: details.refund_address,
      refund_public_key_hash: details.refund_public_key_hash,
      swap_amount: details.swap_amount,
      swap_fee: details.swap_fee,
      swap_key_index: details.swap_key_index,
      swap_p2sh_address: details.swap_p2sh_address,
      swap_p2sh_p2wsh_address: details.swap_p2sh_p2wsh_address,
      swap_p2wsh_address: details.swap_p2wsh_address,
      timeout_block_height: details.timeout_block_height,
    };

    const redeemInfoJsonSpacing = 2;
    let swapAddress = details.swap_p2sh_p2wsh_address;
    const swapAmount = App.format({tokens: details.swap_amount});

    const qs = $.param({amount: swapAmount, message: details.redeem_script});

    let scheme;

    switch (network) {
    case 'bchtestnet':
      scheme = 'bitcoincash';
      swapAddress = details.swap_p2sh_address;
      break;

    case 'ltctestnet':
      scheme = 'litecoin';
      break;

    case 'testnet':
      scheme = 'bitcoin';
      break;

    default:
      console.log([0, 'UnexpectedNetworkForScheme']);
    }

    const addr = `${scheme}:${swapAddress}?${qs}`;

    const qrCode = App.qrCode({
      scheme,
      address: swapAddress,
      amount: swapAmount,
    });

    quote.data({payment_hash: details.payment_hash});
    quote.find('.chain-link').prop('href', addr);
    quote.find('.qr-code').append(qrCode);
    quote.find('.redeem-script').val(details.redeem_script);
    quote.find('.swap-address').val(swapAddress);
    quote.find('.swap-amount').val(swapAmount);
    quote.find('.timeout-block-height').val(details.timeout_block_height);

    quote.find('.save-redeem-script').click(e => {
      const anchor = document.createElement('a');
      const encoding = 'data:text/plain;charset=utf-8';

      const txDetails = App.swaps[details.payment_hash] || {};

      const refundData = {
        network,
        private_key: !isPaperWallet ? undefined : refundKey.private_key,
        redeem_script: details.redeem_script,
        refund_address: address,
        refund_fee_tokens_per_vbyte: details.fee_tokens_per_vbyte,
        refund_after: details.timeout_block_height,
        swap_address: swapAddress,
        swap_amount: swapAmount,
        swap_quote_received_at: new Date().toISOString(),
        transaction_id: txDetails.transaction_id,
        transaction_output_index: txDetails.transaction_output_index,
      };

      refundData.base64 = btoa(JSON.stringify(refundData));

      const text = JSON.stringify(
        refundData,
        null,
        redeemInfoJsonSpacing
      );

      anchor.setAttribute('download', `${swapAddress}.redeem_script.json`);
      anchor.setAttribute('href', `${encoding},${encodeURIComponent(text)}`);

      if (!!document.createEvent) {
        const event = document.createEvent('MouseEvents');

        event.initEvent('click', true, true);
        anchor.dispatchEvent(event);
      } else {
        anchor.click();
      }

      quote.find('.make-payment').collapse('show');
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

/** Submit refund details derivation
*/
App.submitRefundRecovery = function(event) {
  event.preventDefault();

  $('.refund-details-not-found').collapse('hide');

  const clearFields = [
    '.refund-key',
    '.sign-with-refund-details input',
    '.sign-with-refund-details textarea',
    '.signed-refund-transaction',
  ];

  clearFields.forEach(n => $(n).val(''));

  const refundDetails = ($('.refund-details').val() || '').trim();

  let details;

  try {
    details = JSON.parse(refundDetails);
  } catch (err) {
    return console.log([400, 'FailedToParseRefundDetails']);
  }

  if (!!details.network) {
    $('.select-currency').val(details.network);
  }

  if (!!details.redeem_script) {
    $('.refund-details-script').val(details.redeem_script);

    $('.refund-details-script').trigger('change');
  }

  if (!!details.swap_address) {
    $('.select-swap-address').val(details.swap_address);

    const address = details.swap_address;

    switch (details.network) {
    case 'testnet':
      fetch(`https://api.blockcypher.com/v1/btc/test3/addrs/${address}/full`)
        .then(r => r.json())
        .then(details => {
          if (!details || !Array.isArray(details.txs) || !details.txs.length) {
            return;
          }

          let payouts = {};

          details.txs.forEach(({hash, outputs}) => {
            return outputs.forEach(({addresses}, vout) => {
              return addresses.forEach(addr => payouts[addr] = {hash, vout});
            });
          });

          const tx = payouts[address];

          if (!!tx && !!tx.hash && !$('.refund-transaction-id').val()) {
            $('.refund-transaction-id').val(tx.hash);
          }

          if (!!tx && tx.vout !== undefined && !$('.refund-tx-vout').val()) {
            $('.refund-tx-vout').val(tx.vout);
          }

          return;
        })
        .catch(err => {
          console.log([503, 'FailedToFetchAddressDetails', err]);
          return;
        });
      break;

    case 'bchtestnet':
      fetch(`https://test-bch-insight.bitpay.com/api/addrs/${address}/utxo`)
        .then(r => r.json())
        .then(transactions => {
          if (!Array.isArray(transactions) || !transactions.length) {
            return;
          }

          const [tx] = transactions;

          if (!!tx && !!tx.txid && !$('.refund-transaction-id').val()) {
            $('.refund-transaction-id').val(tx.txid);
          }

          if (!!tx && tx.vout !== undefined && !$('.refund-tx-vout').val()) {
            $('.refund-tx-vout').val(tx.vout);
          }

          return;
        })
        .catch(err => {
          console.log([503, 'FailedToFetchAddressDetails']);
          return;
        });
      break;

    case 'ltctestnet':
      fetch(`https://chain.so/api/v2/get_tx_received/LTCTEST/${address}`)
        .then(r => r.json())
        .then(details => {
          if (!details || !details.data || !Array.isArray(details.data.txs)) {
            return;
          }

          if (!details.data.txs.length) {
            return;
          }

          const [tx] = details.data.txs;

          if (!tx) {
            return;
          }

          if (!!tx.txid && !$('.refund-transaction-id').val()) {
            $('.refund-transaction-id').val(tx.txid);
          }

          if (tx.output_no !== undefined && !$('.refund-tx-vout').val()) {
            $('.refund-tx-vout').val(tx.output_no);
          }

          return;
        })
        .catch(err => {
          console.log([503, 'FailedToFetchAddressDetails']);
          return;
        });

    default:
      break;
    }
  }

  if (!!details.transaction_id) {
    $('.refund-transaction-id').val(details.transaction_id);
  }

  if (details.transaction_output_index !== undefined) {
    $('.refund-tx-vout').val(details.transaction_output_index);
  }

  if (!!details.swap_amount) {
    $('.tokens-total').val(details.swap_amount);
  }

  if (!!details.refund_fee_tokens_per_vbyte) {
    $('.refund-fee').val(details.refund_fee_tokens_per_vbyte);
  } else {
    $('.refund-fee').val(1);
  }

  if (!!details.private_key) {
    $('.refund-key').val(details.private_key);
  }

  if (!!details.refund_address) {
    $('.refund-address').val(details.refund_address);
  }

  $('#tx-details-refund-tab').tab('show');

  $('.generic.refund-tx-failure').collapse('hide');
  $('.refund-tx-success').collapse('hide');

  return;
};

/** Submit sign refund transaction with details form
*/
App.submitSignWithRefundDetails = function(e) {
  e.preventDefault();

  const redeemScript = $(this).find('.refund-details-script').val().trim();

  if (!redeemScript) {
    return console.log([0, 'ExpectedRedeemScript']);
  }

  let swapDetails;

  try {
    swapDetails = blockchain.swapScriptDetails({
      network: $('.select-currency').val(),
      script: redeemScript,
    });
  } catch (e) {
    return console.log([0, 'FailedToDeriveSwapDetails'], e);
  }

  const network = $('.select-currency').val();
  const refundAddress = $('.refund-address').val().trim();
  const refundFee = parseInt($('.refund-fee').val().trim(), 10);
  const refundKey = $('.refund-key').val().trim();
  const refundAmount = $('.tokens-total').val().trim();
  const refundTxId = $('.refund-transaction-id').val().trim();
  const refundTxVout = parseInt($('.refund-tx-vout').val().trim(), 10);
  const swapAddress = $('.select-swap-address').val();

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
      network,
      destination: refundAddress,
      fee_tokens_per_vbyte: refundFee,
      is_public_key_hash_refund: true,
      private_key: refundKey,
      timelock_block_height: swapDetails.timelock_block_height,
      utxos: [{
        redeem: redeemScript,
        script: $('.select-swap-address').data()[swapAddress],
        tokens: refundTokens,
        transaction_id: refundTxId,
        vout: refundTxVout,
      }],
    });
  } catch (err) {
    $('.signed-refund-transaction').val('');

    console.log([400, 'ERROR', err]);

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
  $('.refund-tx-success').collapse('hide');

  App.makeRequest({
    post: {network, transaction: refund.transaction},
    api: 'transactions/',
  })
  .then(details => {
    if (!details.id) {
      return;
    }

    let txUrl;

    switch (network) {
    case 'bchtestnet':
      txUrl = `https://www.blocktrail.com/tBCC/tx/${details.id}`;
      break;

    case 'testnet':
      txUrl = `https://testnet.smartbit.com.au/tx/${details.id}`;
      break;

    case 'ltctestnet':
      txUrl = `https://chain.so/tx/LTCTEST/${details.id}`;
      break;
    }

    $('.refund-tx-success').collapse('show');
    $('.refund-tx-success .refund-address').text(refundAddress);
    $('.refund-tx-success .link-to-refund').text(details.id);
    $('.refund-tx-success .link-to-refund').prop('href', txUrl);

    return;
  })
  .catch(err => {
    console.log([503, 'FailedToBroadcastTransaction', err]);

    return;
  });

  return;
};

/** Update the swap details

  {
    swap: <Swap DOM Object>
  }
*/
App.updatedSwapDetails = ({swap}) => {
  if (!swap.find('.pay-to-lightning-invoice').length) {
    return;
  }

  const address = swap.find('.refund-address').val().trim();
  const invoice = swap.find('.pay-to-lightning-invoice').val().trim();
  const network = swap.find('.select-currency').val();

  const hasAddress = !!App.address_details[address];
  const hasInvoiceDetails = !!App.invoice_details[invoice];
  const keyPair = blockchain.generateKeyPair({network});

  if (!!hasInvoiceDetails && !!swap.find('.refund-address-entry.hide')) {
    swap.find('.refund-address-entry').collapse('show');
  }

  const isPaperRefund = !!swap.find('#use-paper-wallet').is(':checked');

  if (!!hasAddress && !isPaperRefund) {
    swap.find('.refund-address')
      .addClass('is-valid')
      .removeClass('is-invalid');
  }

  swap.find('.pay-to-lightning-invoice')
    .toggleClass('is-valid', !!hasInvoiceDetails)
    .toggleClass('is-invalid', !hasInvoiceDetails && !!invoice);

  const isReady = (!!hasAddress || !!isPaperRefund) && !!hasInvoiceDetails;

  App.invoice_refund_keypairs[invoice] = keyPair;

  let baseFee = 0;
  let feePercentage = '';
  let fiatPrice = '';
  let networkAddressName = '';
  let totalFee = 0;
  let conversionRate = 1;

  switch (network) {
  case 'bchtestnet':
    if (!App.rates['bchtestnet']) {
      break;
    }

    baseFee = App.rates['bchtestnet'].fees[0].base;
    conversionRate = App.rates['testnet'].cents / App.rates['bchtestnet'].cents;
    feePercentage = App.rates['bchtestnet'].fees[0].rate / 1e6 * 100;
    fiatPrice = (App.rates['bchtestnet'].cents) * 1e8 / 100;
    networkAddressName = 'BCash testnet';

    break;

  case 'ltctestnet':
    if (!App.rates['ltctestnet']) {
      break;
    }

    baseFee = App.rates['ltctestnet'].fees[0].base;
    conversionRate = App.rates['testnet'].cents / App.rates['ltctestnet'].cents;
    feePercentage = App.rates['ltctestnet'].fees[0].rate / 1e6 * 100;
    fiatPrice = (App.rates['ltctestnet'].cents) * 1e8 / 100;
    networkAddressName = 'Litecoin testnet';

    break;

  case 'testnet':
    if (!App.rates['testnet']) {
      break;
    }

    baseFee = App.rates['testnet'].fees[0].base;
    feePercentage = App.rates['testnet'].fees[0].rate / 1e6 * 100;
    fiatPrice = (App.rates['testnet'].cents) * 1e8 / 100;
    networkAddressName = 'Bitcoin testnet';
    break;

  default:
    return console.log([0, 'UnexpectedNetworkName']);
    break;
  }

  if (!!App.invoice_details[invoice]) {
    const {tokens} = App.invoice_details[invoice];

    totalFee = App.invoice_details[invoice].fee_fiat_value / 100;
  }

  swap.find('.address-currency-label').text(networkAddressName);
  swap.find('.current-fiat-price').text(fiatPrice.toFixed(2));
  swap.find('.fee-percentage').text(feePercentage.toFixed(2));
  swap.find('.fiat-fee-total').text(totalFee.toFixed(2));
  swap.find('.final-fee').prop('hidden', !totalFee);

  swap.find('.make').toggleClass('disabled', !isReady);

  return;
};

/** Update invoice details

  {
    swap: <Create Swap Quote Swap DOM Object>
  }
*/
App.updateInvoiceDetails = ({swap}) => {
  const input = swap.find('.pay-to-lightning-invoice');

  const detailsDisplay = swap.find('.invoice-details');
  const invoice = input.val().trim();
  const network = swap.find('.select-currency').val();

  const quoteFor = [network, invoice].join('/');

  // Exit early when the invoice has not changed
  if (swap.data().quote_for === quoteFor) {
    return;
  }

  swap.data({invoice, quote_for: quoteFor});

  detailsDisplay.collapse('hide');

  $('.has-invoice-problem').prop('hidden', true);

  // Exit early when the invoice has been removed
  if (!invoice) {
    App.updatedSwapDetails({swap});

    $('.looking-up-invoice').prop('hidden', true);
    $('.not-looking-up-invoice').prop('hidden', false);
    $('.has-invoice-problem').prop('hidden', true);

    return input.removeClass('is-invalid').removeClass('is-valid');
  }

  $('.looking-up-invoice').prop('hidden', false);
  $('.not-looking-up-invoice').prop('hidden', true);

  return App.getInvoiceDetails({invoice, network}, (err, details) => {
    // Exit early when input has changed while the fetch was happening.
    if (input.val().trim() !== invoice) {
      return;
    }

    $('.looking-up-invoice').prop('hidden', true);
    $('.not-looking-up-invoice').prop('hidden', false);
    $('.has-invoice-problem').prop('hidden', true);

    if (!!err) {
      const [errCode, errMessage] = err;

      detailsDisplay.collapse('hide');

      $('.has-invoice-problem').prop('hidden', false);
      $('.not-looking-up-invoice').prop('hidden', true);
      input.addClass('is-invalid');

      let text;

      switch (errMessage) {
      case 'ChainFeesTooHighToSwap':
        text = 'Value too low for a chain swap. Use a higher value invoice?';
        break;

      case 'DecodeInvoiceFailure':
        text = 'Couldn\'t read this invoice. Try a different one?';
        break;

      case 'Failed to fetch':
        text = `Couldn\'t connect to swap server. Try again?`;
        break;

      case 'InsufficientCapacityForSwap':
        text = 'Value is too high to swap. Use a lower value invoice?';
        break;

      case 'InvoiceExpiresTooSoon':
        text = 'This invoice expires too soon, get a fresh invoice?';
        break;

      case 'NoCapacityToDestination':
        text = 'Can\'t send to this destination, establishing connectivity...';
        break;

      case 'PendingChannelToDestination':
        text = 'Channel to destination is still opening, try again later...';
        break;

      default:
        console.log('ERR', err);
        text = 'Unexpected error :( try again or with a different invoice?';
        break;
      }

      swap.find('.invoice-issue').text(text);

      return;
    }

    App.invoice_details[invoice] = details;

    App.showInvoice({invoice, swap});

    App.updatedSwapDetails({swap});

    return;
  });
};

$(() => App.init({}));

