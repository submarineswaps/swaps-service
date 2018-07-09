const {ceil} = Math;
const {floor} = Math;
const {max} = Math;
const {min} = Math;
const {now} = Date;

const {networkParameters} = require('./../chain');

const channelMinMargin = 1.01;

/** Check that an invoice can be paid in the context of a swap.

  A user can check this when looking at an invoice, can a swap happen?
  A swap provider can check this before offering a swap quote
  A swap provider can check this before paying the swap invoice

  What makes an invoice payable?
  - A route to the destination needs to be present
  - The route timeout needs to happen well before the refund height
  - The invoice has to expire after the funding can confirm
  - The chain height has to be well above the refund height
  - The routing fee and anticipated sweep fee have to be below the charged fee

  {
    claim_window: <Block Count Required to Sweep Claim Number>
    current_height: <Current Block Height Number>
    destination: <Invoice Destination Public Key Hex String>
    destination_height: <Destination Current Block Height Number>
    destination_network: <Destination Network Name String>
    expires_at: <Invoice Expires At ISO 8601 Date String>
    [funded_height]: <Expected/Existing Funded Block Height Number>
    invoice_network: <Invoice Network Name String>
    network: <Network Name String>
    pending_channels: [{
      is_opening: <Channel Is In Opening State Bool>
      local_balance: <Channel Opening Balance Tokens Number>
      partner_public_key: <Remote Public Key Hex String>
    }]
    refund_height: <On-Chain Refund Block Height Number>
    required_confirmations: <Required Funding Confirmation Count Number>
    routes: [{
      fee: <Fee Token Number>
      timeout: <Timeout Block Height Number>
    }]
    swap_fee: <Total Swap Fee Tokens Number>
    sweep_fee: <Claim Sweep Fee Tokens Number>
    tokens: <Tokens to Send Number>
  }

  @throws Error when invoice is not payable
  CapacityForSwapIsPending // No capacity, but channel is pending
  InsufficientCapacityForSwap // Capacity only supports lower value for send
  InvoiceExpiresTooSoon // Invoice will expire before funding can confirm
  InvoiceMissingTokens // No tokens specified to swap
  InsufficientSwapFee // The swap fee doesn't cover the server's swap fees
  RefundHeightTooClose // The refund height approaches, not safe to pay
  RouteTimeoutHeightTooClose // Window to pay invoice has closed
*/
module.exports = args => {
  if (!args.claim_window) {
    throw new Error('ExpectedBlockWindowToExecuteClaimTransaction');
  }

  if (!args.current_height) {
    throw new Error('ExpectedCurrentChainHeight');
  }

  if (!args.destination_height) {
    throw new Error('ExpectedDestinationChainHeight');
  }

  if (!args.expires_at) {
    throw new Error('ExpectedInvoiceExpirationDate');
  }

  if (!args.invoice_network) {
    throw new Error('ExpectedInvoiceNetworkName');
  }

  if (!args.network) {
    throw new Error('ExpectedNetworkNameForInvoicePayableCheck');
  }

  if (!networkParameters[args.network]) {
    throw new Error('ExpectedKnownNetworkBlockTimeValue');
  }

  if (args.required_confirmations === undefined) {
    throw new Error('ExpectedRequiredConfirmationCountValue');
  }

  if (!Array.isArray(args.routes)) {
    throw new Error('ExpectedRoutesToCheck');
  }

  if (!args.swap_fee) {
    throw new Error('ExpectedSwapFeeAmount');
  }

  if (!args.sweep_fee) {
    throw new Error('ExpectedSweepFeeEstimate');
  }

  if (!args.tokens) {
    throw new Error('InvoiceMissingTokens');
  }

  const hasPendingChan = args.pending_channels
    .filter(n => !!n.is_opening)
    .filter(n => n.local_balance > ceil(args.tokens * channelMinMargin))
    .map(n => n.partner_public_key)
    .find(n => n === args.destination);

  // Is there a route available that can send the tokens?
  if (!args.routes.length) {
    if (!!hasPendingChan) {
      throw new Error('CapacityForSwapIsPending');
    } else {
      throw new Error('InsufficientCapacityForSwap');
    }
  }

  const chainHeight = args.current_height;
  const hasConfirmations = !!args.funded_height;
  const maxRoutingFee = max(...args.routes.map(({fee}) => fee));
  const minRouteTimeout = min(...args.routes.map(({timeout}) => timeout));
  const msPerBlock = networkParameters[args.network].ms_per_block;
  const msPerDestBlock = networkParameters[args.invoice_network].ms_per_block;

  const blocksUntilRefund = args.refund_height - chainHeight;
  const fundedConfs = !hasConfirmations ? 0 : chainHeight - args.funded_height;

  const confsUntilFundingConfirmed = args.required_confirmations - fundedConfs;

  const blockSpeedModifier = msPerBlock / msPerDestBlock;

  const refundDistance = args.refund_height - args.current_height;
  const routeFinalityDistance = minRouteTimeout - args.destination_height;

  const relativeFinality = floor(routeFinalityDistance / blockSpeedModifier);

  // Are there too few blocks remaining to safely execute a claim sweep?
  if (blocksUntilRefund < args.claim_window) {
    throw new Error('RefundHeightTooClose');
  }

  // Does the payment timeout happen too close to the refund height?
  if (relativeFinality - refundDistance < args.claim_window) {
    throw new Error('RouteTimeoutHeightTooClose');
  }

  // Can the funding transaction confirm before the invoice expires?
  if (confsUntilFundingConfirmed > 0) {
    const expectedWaitMs = msPerBlock * confsUntilFundingConfirmed;

    const expectedConfirmationDate = new Date(now() + expectedWaitMs);

    if (expectedConfirmationDate.toISOString() > args.expires_at) {
      throw new Error('InvoiceExpiresTooSoon');
    }
  }

  if (args.swap_fee < args.sweep_fee + maxRoutingFee) {
    throw new Error('InsufficientSwapFee');
  }

  return;
};

