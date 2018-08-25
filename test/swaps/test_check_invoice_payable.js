const {ceil} = Math;

const {doesNotThrow} = require('tap');
const {throws} = require('tap');

const {checkInvoicePayable} = require('./../../swaps');

const fixtures = {
  chain_height: 500000,
  claim_window: 10,
  expires_at: new Date(Date.now() + 1e8).toISOString(),
  fee: 1000,
  network: 'testnet',
  public_key: '03e50492eab4107a773141bb419e107bda3de3d55652e6e1a41225f06a0bbf2d56',
  refund_height: 500100,
  required_confirmations: 3,
  route: {fee: 100, timeout: 500150},
  swap_fee: 250,
  sweep_fee: 150,
  tokens: 100,
};

const tests = {
  // An invoice that is expiring throws an error
  invoice_expires_too_soon: {
    args: {
      claim_window: fixtures.claim_window,
      current_height: fixtures.chain_height,
      destination: fixtures.public_key,
      destination_height: fixtures.chain_height,
      expires_at: new Date().toISOString(),
      funded_height: fixtures.chain_height - 1,
      invoice_network: fixtures.network,
      network: fixtures.network,
      pending_channels: [],
      refund_height: fixtures.refund_height,
      required_confirmations: fixtures.required_confirmations,
      routes: [fixtures.route],
      swap_fee: fixtures.swap_fee,
      sweep_fee: fixtures.sweep_fee,
      tokens: fixtures.tokens,
    },
    expected_error: 'InvoiceExpiresTooSoon',
  },

  // An invoice that has no tokens throws an error
  invoice_has_no_tokens: {
    args: {
      claim_window: fixtures.claim_window,
      current_height: fixtures.chain_height,
      destination: fixtures.public_key,
      destination_height: fixtures.chain_height,
      expires_at: fixtures.expires_at,
      invoice_network: fixtures.network,
      network: fixtures.network,
      pending_channels: [],
      refund_height: fixtures.refund_height,
      required_confirmations: fixtures.required_confirmations,
      routes: [fixtures.route],
      swap_fee: fixtures.swap_fee,
      sweep_fee: fixtures.sweep_fee,
      tokens: 0,
    },
    expected_error: 'InvoiceMissingTokens',
  },

  // There isn't enough capacity to send to this invoice
  insufficient_capacity_to_swap: {
    args: {
      claim_window: fixtures.claim_window,
      current_height: fixtures.chain_height,
      destination: fixtures.public_key,
      destination_height: fixtures.chain_height,
      expires_at: fixtures.expires_at,
      fee: fixtures.fee,
      invoice_network: fixtures.network,
      network: fixtures.network,
      pending_channels: [
        {
          // Pending channel that is closing
          is_opening: false,
          local_balance: ceil(fixtures.tokens * 1.02),
          partner_public_key: fixtures.public_key,
        },
        {
          // Pending channel that has an insufficient balance to swap
          is_opening: true,
          local_balance: ceil(fixtures.tokens),
          partner_public_key: fixtures.public_key,
        },
        {
          // Pending channel but with a different destination
          is_opening: true,
          local_balance: ceil(fixtures.tokens * 2),
          partner_public_key: '024655b768ef40951b20053a5c4b951606d4d86085d51238f2c67c7dec29c792ca',
        },
      ],
      refund_height: fixtures.refund_height,
      required_confirmations: fixtures.required_confirmations,
      routes: [],
      swap_fee: fixtures.swap_fee,
      sweep_fee: fixtures.sweep_fee,
      tokens: fixtures.tokens,
    },
    expected_error: 'InsufficientCapacityForSwap',
  },

  // Ignore that invoice times out soon because the swap is fully funded
  soon_expiring_invoice_is_funded: {
    args: {
      claim_window: fixtures.claim_window,
      current_height: fixtures.chain_height,
      destination: fixtures.public_key,
      destination_height: fixtures.chain_height,
      expires_at: new Date(Date.now() + 60 * 1000).toISOString(),
      funded_height: fixtures.chain_height - fixtures.required_confirmations,
      invoice_network: fixtures.network,
      network: fixtures.network,
      pending_channels: [],
      refund_height: fixtures.refund_height,
      required_confirmations: fixtures.required_confirmations,
      routes: [fixtures.route],
      swap_fee: fixtures.swap_fee,
      sweep_fee: fixtures.sweep_fee,
      tokens: fixtures.tokens,
    },
    expected_error: null,
  },

  // Make sure that there is a window of time after payment settles for claim
  payment_timeout_too_near_refund_unlock: {
    args: {
      claim_window: fixtures.claim_window,
      current_height: fixtures.chain_height,
      destination: fixtures.public_key,
      destination_height: fixtures.chain_height,
      expires_at: new Date().toISOString(),
      funded_height: fixtures.chain_height - fixtures.required_confirmations,
      invoice_network: fixtures.network,
      network: fixtures.network,
      pending_channels: [],
      refund_height: fixtures.refund_height,
      required_confirmations: fixtures.required_confirmations,
      routes: [{fee: 1, timeout: fixtures.refund_height - 3}],
      swap_fee: fixtures.swap_fee,
      sweep_fee: fixtures.sweep_fee,
      tokens: fixtures.tokens,
    },
    expected_error: 'RouteTimeoutHeightTooClose',
  },

  // Route timeout values are modified by chain speed
  payment_timeout_too_near_refund_unlock_with_chain_speed_relativity: {
    args: {
      claim_window: fixtures.claim_window,
      current_height: fixtures.chain_height,
      destination: fixtures.public_key,
      destination_height: fixtures.chain_height,
      expires_at: new Date().toISOString(),
      funded_height: fixtures.chain_height - fixtures.required_confirmations,
      invoice_network: 'ltctestnet',
      network: fixtures.network,
      pending_channels: [],
      refund_height: fixtures.refund_height,
      required_confirmations: fixtures.required_confirmations,
      routes: [{fee: 1, timeout: fixtures.refund_height + 10}],
      swap_fee: fixtures.swap_fee,
      sweep_fee: fixtures.sweep_fee,
      tokens: fixtures.tokens,
    },
    expected_error: 'RouteTimeoutHeightTooClose',
  },

  // No route but pending channel results in specialized error
  insufficient_capacity_to_swap: {
    args: {
      claim_window: fixtures.claim_window,
      current_height: fixtures.chain_height,
      destination: fixtures.public_key,
      destination_height: fixtures.chain_height,
      expires_at: fixtures.expires_at,
      fee: fixtures.fee,
      invoice_network: fixtures.network,
      network: fixtures.network,
      pending_channels: [{
        is_opening: true,
        local_balance: ceil(fixtures.tokens * 1.02),
        partner_public_key: fixtures.public_key,
      }],
      refund_height: fixtures.refund_height,
      required_confirmations: fixtures.required_confirmations,
      routes: [],
      swap_fee: fixtures.swap_fee,
      sweep_fee: fixtures.sweep_fee,
      tokens: fixtures.tokens,
    },
    expected_error: 'CapacityForSwapIsPending',
  },
};

Object.keys(tests).map(k => tests[k]).forEach(test => {
  if (!test.expected_error) {
    return doesNotThrow(() => checkInvoicePayable(test.args));
  }

  throws(() => checkInvoicePayable(test.args), new Error(test.expected_error));

  return;
});

