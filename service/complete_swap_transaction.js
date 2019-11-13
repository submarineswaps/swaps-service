const asyncAuto = require('async/auto');
const asyncDetectSeries = require('async/detectSeries');
const {createChainAddress} = require('ln-service');
const {createInvoice} = require('ln-service');
const {getPayment} = require('ln-service');
const {payViaPaymentRequest} = require('ln-service');
const {payViaRoutes} = require('ln-service');
const {returnResult} = require('asyncjs-util');
const {subscribeToProbe} = require('ln-service');
const uuidv4 = require('uuid/v4');

const addDetectedSwap = require('./../pool/add_detected_swap');
const {addressDetails} = require('./../chain');
const {broadcastTransaction} = require('./../chain');
const {checkInvoicePayable} = require('./../swaps');
const {claimTransaction} = require('./../swaps');
const getFeeForSwap = require('./get_fee_for_swap');
const {getFeeRate} = require('./../blocks');
const {getRecentChainTip} = require('./../blocks');
const {getRecentFeeRate} = require('./../blocks');
const {parsePaymentRequest} = require('./../lightning');
const {lightningDaemon} = require('./../lightning');
const {setJsonInCache} = require('./../cache');
const swapParameters = require('./swap_parameters');
const {swapScriptDetails} = require('./../swaps');
const {swapScriptInTransaction} = require('./../swaps');

const bufferBlocks = 144;
const defaultLtcTimeout = 144 * 4;
const dummyLockingInvoiceValue = 1;
const dummyPreimage = '0000000000000000000000000000000000000000000000000000000000000000';
const estimatedTxVirtualSize = 200;
const highestPriority = 0;
const maxAttemptedRoutes = 100;
const maxBtcBlocks = 1 * 144 * 5;
const maxLtcBlocks = 4 * 144 * 5;
const {now} = Date;
const pathfindingTimeoutMs = 1000 * 60 * 10;
const paymentTimeoutMs = 1000 * 60 * 10;
const priority = 0;
const {stringify} = JSON;
const swapSuccessCacheMs = 1000 * 60 * 60;
const timeoutBuffer = 20;

/** Complete a swap transaction

  When the swap has already been completed

  {
    cache: <Cache Type String>
    index: <Key Index Number>
    invoice: <Bolt 11 Invoice String>
    key: <Private Key WIF String>
    network: <Network Name String>
    script: <Redeem Script Hex String>
    transaction: <Funding Transaction Hex String>
  }

  @returns via cbk
  {
    funding_utxos: [{
      redeem: <Redeem Script Hex String>
      script: <ScriptPub Hex String>
      tokens: <Tokens Number>
      transaction_id: <Transaction Id Hex String>
      vout: <Vout Number>
    }]
    invoice_id: <Invoice Id Hex String>
    payment_secret: <Payment Secret Hex String>
    transaction_id: <Transaction Id Hex String>
  }
*/
module.exports = (args, cbk) => {
  const {cache, index, invoice, key, network, script, transaction} = args;

  return asyncAuto({
    // Check completion arguments
    validate: cbk => {
      if (!cache) {
        return cbk([400, 'ExpectedCacheToStoreSwapSuccess']);
      }

      if (index === undefined) {
        return cbk([400, 'ExpectedKeyIndexToCompleteSwapTransaction']);
      }

      if (!invoice) {
        return cbk([400, 'ExpectedInvoice']);
      }

      if (!key) {
        return cbk([400, 'ExpectedPrivateKey']);
      }

      if (!network) {
        return cbk([400, 'ExpectedNetwork']);
      }

      if (!script) {
        return cbk([400, 'ExpectedRedeemScript']);
      }

      if (!transaction) {
        return cbk([400, 'ExpectedFundingTransaction']);
      }

      return cbk();
    },

    // Funding UTXOs from the transaction
    fundingUtxos: ['validate', ({}, cbk) => {
      try {
        return cbk(null, swapScriptInTransaction({
          transaction,
          redeem_script: script,
        }));
      } catch (err) {
        return cbk([500, e.message, err]);
      }
    }],

    // Check the current state of the blockchain to get a good locktime
    getChainTip: ['validate', ({}, cbk) => {
      return getRecentChainTip({network, priority}, cbk);
    }],

    // Figure out what fee is needed to sweep the funds
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

    // Initialize the LN daemon connection
    lnd: ['parsedInvoice', ({parsedInvoice}, cbk) => {
      try {
        return cbk(null, lightningDaemon({network: parsedInvoice.network}));
      } catch (err) {
        return cbk([500, 'FailedToInitLightningDaemonConnection', {err}]);
      }
    }],

    // Probe the route
    getRoute: [
      'getInvoiceChainTip',
      'getSwapFee',
      'lnd',
      'parsedInvoice',
      'swapParams',
      ({
        getInvoiceChainTip,
        getSwapFee,
        lnd,
        parsedInvoice,
        swapParams,
      },
      cbk) =>
    {
      const date = new Date().toISOString();
      const result = {};
      const swapDetails = swapScriptDetails({network, script});

      const sub = subscribeToProbe({
        lnd,
        cltv_delta: parsedInvoice.cltv_delta,
        destination: parsedInvoice.destination,
        max_fee: getSwapFee.converted_fee,
        max_timeout_height: swapDetails.timelock_block_height - bufferBlocks,
        routes: parsedInvoice.routes,
        tokens: parsedInvoice.tokens,
      });

      const timeout = setTimeout(() => {
        sub.removeAllListeners();

        return cbk([503, 'FailedToFindRouteWhenCompletingSwapTransaction']);
      },
      pathfindingTimeoutMs);

      sub.on('error', err => result.err = err);

      sub.on('probe_success', ({route}) => {
        const routeTimeoutDelta = route.timeout - getInvoiceChainTip.height;

        if (routeTimeoutDelta + timeoutBuffer > swapParams.refund_timeout) {
          return;
        }

        result.err = null;
        result.route = route;

        return;
      });

      sub.on('routing_failure', failure => {
        result.err = [503, 'RoutingFailure', {failure}];

        return addDetectedSwap({
          cache,
          id: parsedInvoice.id,
          attempt: {
            date,
            hops: failure.route.hops.map(n => n.channel),
            id: uuidv4(),
            type: 'attempt',
          },
        },
        () => {});
      });

      sub.on('end', () => {
        const {err} = result;

        clearTimeout(timeout);

        if (!!err) {
          return cbk([503, 'FailedToGetRouteForSwapCompletion', {err}]);
        }

        if (!result.route) {
          return cbk([400, 'FailedToFindPathForSwapCompletion']);
        }

        const blocksRemaining = result.route.timeout - getInvoiceChainTip.height;

        switch (parsedInvoice.network) {
        case 'ltc':
        case 'ltctestnet':
          if (blocksRemaining > maxLtcBlocks) {
            return cbk([503, 'FailedToFindReasonableTimeoutRoute']);
          }
          break;

        default:
          if (blocksRemaining > maxBtcBlocks) {
            return cbk([503, 'FailedToFindReasonableTimeoutRoute']);
          }
        }

        return cbk(null, {route: result.route});
      });
    }],

    // Current chain state
    chainState: [
      'getChainTip',
      'getFeeRate',
      'getInvoiceChainTip',
      'swapParams',
      ({getChainTip, getFeeRate, getInvoiceChainTip, swapParams}, cbk) =>
    {
      return cbk(null, {
        current_height: getChainTip.height,
        destination_height: getInvoiceChainTip.height,
        refund_height: getChainTip.height + swapParams.timeout,
        sweep_fee: getFeeRate.fee_tokens_per_vbyte * estimatedTxVirtualSize,
      });
    }],

    // Check to make sure the invoice can be paid
    checkPayable: [
      'chainState',
      'getRoute',
      'getSwapFee',
      'parsedInvoice',
      'swapParams',
      ({chainState, getSwapFee, parsedInvoice, getRoute, swapParams}, cbk) =>
    {
      try {
        const check = checkInvoicePayable({
          network,
          claim_window: swapParams.claim_window,
          current_height: chainState.current_height,
          destination: parsedInvoice.destination,
          destination_height: chainState.destination_height,
          expires_at: parsedInvoice.expires_at,
          invoice_network: parsedInvoice.network,
          is_ignoring_expiry: true,
          pending_channels: [],
          refund_height: chainState.refund_height,
          required_confirmations: swapParams.funding_confs,
          routes: [getRoute],
          swap_fee: getSwapFee.fee,
          sweep_fee: chainState.sweep_fee,
          tokens: parsedInvoice.tokens,
        });

        return cbk();
      } catch (err) {
        return cbk([400, err.message]);
      }
    }],

    // Get the payment status
    getPayment: ['lnd', 'parsedInvoice', ({lnd, parsedInvoice}, cbk) => {
      return getPayment({lnd, id: parsedInvoice.id}, (err, res) => {
        // Ignore errors
        if (!!err) {
          return cbk();
        }

        return cbk(null, res);
      });
    }],

    // Hack around the locking failure of paying invoices twice
    createLockingInvoice: [
      'checkPayable',
      'fundingUtxos',
      'getChainTip',
      'getFeeRate',
      'getPayment',
      'getRoute',
      'lnd',
      'parsedInvoice',
      ({fundingUtxos, getChainTip, getPayment, lnd, parsedInvoice}, cbk) =>
    {
      // Exit early when the payment already exists
      if (!!getPayment) {
        return cbk();
      }

      const {id} = parsedInvoice;

      const [utxo] = fundingUtxos.matching_outputs;

      const description = stringify({
        index,
        network,
        script,
        height: getChainTip.height,
        id: utxo.transaction_id,
        vout: utxo.vout,
      });

      return createInvoice({
        description,
        lnd,
        expires_at: new Date(now() + paymentTimeoutMs).toISOString(),
        secret: id,
        tokens: dummyLockingInvoiceValue,
      },
      err => {
        if (!!err) {
          return cbk([503, 'FailedToCreateLockingInvoice', {err}]);
        }

        return cbk();
      });
    }],

    // Chain lnd
    chainLnd: ['validate', ({}, cbk) => {
      const net = network.toUpperCase();

      const address = process.env[`SSS_CLAIM_${net}_ADDRESS`];

      if (!!address) {
        return cbk();
      }

      try {
        return cbk(null, lightningDaemon({network}));
      } catch (err) {
        return cbk([500, 'FailedToInitChainLndConnection', {err}]);
      }
    }],

    // Make a new address to sweep out the funds to
    getSweepAddress: ['createLockingInvoice', 'chainLnd', ({chainLnd}, cbk) => {
      const net = network.toUpperCase();

      const address = process.env[`SSS_CLAIM_${net}_ADDRESS`];

      if (!!address) {
        return cbk(null, {address});
      }

      return createChainAddress({
        format: 'p2wpkh',
        is_unused: true,
        lnd: chainLnd,
      },
      cbk);
    }],

    // Make sure that the sweep address is OK
    checkSweepAddress: ['getSweepAddress', ({getSweepAddress}, cbk) => {
      const {address} = getSweepAddress;

      try {
        const {type} = addressDetails({address, network});

        switch (type) {
        case 'p2wpkh':
        case 'p2wsh':
        case 'p2pkh':
        case 'p2sh':
          return cbk();

        default:
          return cbk([500, 'UnknownClaimAddressType', address, type]);
        }
      } catch (err) {
        return cbk([500, 'InvalidClaimAddress', address]);
      }
    }],

    // Do a sanity check to see if the invoice can be claimed
    canClaim: [
      'checkSweepAddress',
      'fundingUtxos',
      'getChainTip',
      'getFeeRate',
      'getSweepAddress',
      ({fundingUtxos, getChainTip, getFeeRate, getSweepAddress}, cbk) =>
    {
      try {
        return cbk(null, claimTransaction({
          network,
          current_block_height: getChainTip.height,
          destination: getSweepAddress.address,
          fee_tokens_per_vbyte: getFeeRate.fee_tokens_per_vbyte,
          preimage: dummyPreimage,
          private_key: key,
          utxos: fundingUtxos.matching_outputs,
        }));
      } catch (err) {
        return cbk([500, 'ExpectedDummyClaimTransaction', err]);
      }
    }],

    // Pay the invoice
    payInvoice: [
      'canClaim',
      'createLockingInvoice',
      'getPayment',
      'getRoute',
      'lnd',
      'parsedInvoice',
      ({getPayment, getRoute, lnd, parsedInvoice}, cbk) =>
    {
      const existing = getPayment;

      // Exit early when payment is already pending or finished
      if (!!existing && (!!existing.is_pending || !!existing.is_confirmed)) {
        return cbk();
      }

      return payViaRoutes({
        lnd,
        id: parsedInvoice.id,
        routes: [getRoute.route],
      },
      cbk);
    }],

    // Create a claim transaction to sweep the swap to the destination address
    claimTransaction: [
      'fundingUtxos',
      'getChainTip',
      'getFeeRate',
      'getPayment',
      'getSweepAddress',
      'payInvoice',
      ({
        fundingUtxos,
        getChainTip,
        getFeeRate,
        getPayment,
        getSweepAddress,
        payInvoice,
      },
      cbk) =>
    {
      const existingPayment = getPayment || {};

      const {secret} = payInvoice || existingPayment.payment || {};

      // Exit early when the preimage is not yet known
      if (!secret) {
        return cbk();
      }

      try {
        return cbk(null, claimTransaction({
          network,
          current_block_height: getChainTip.height,
          destination: getSweepAddress.address,
          fee_tokens_per_vbyte: getFeeRate.fee_tokens_per_vbyte,
          preimage: secret,
          private_key: key,
          utxos: fundingUtxos.matching_outputs,
        }));
      } catch (err) {
        return cbk([500, 'ExpectedClaimTransaction', err]);
      }
    }],

    // Broadcast the claim transaction
    broadcastTransaction: ['claimTransaction', ({claimTransaction}, cbk) => {
      // Exit early when there is no claim tx to broadcast
      if (!claimTransaction) {
        return cbk();
      }

      return broadcastTransaction({
        network,
        priority: highestPriority,
        transaction: claimTransaction.transaction
      },
      err => {
        // Ignore broadcast errors
        return cbk();
      });
    }],

    // Return the details of the completed swap
    completedSwap: [
      'claimTransaction',
      'fundingUtxos',
      'getPayment',
      'parsedInvoice',
      'payInvoice',
      ({
        claimTransaction,
        fundingUtxos,
        getPayment,
        parsedInvoice,
        payInvoice,
      },
      cbk) =>
    {
      const existingPayment = getPayment || {};

      const {secret} = payInvoice || existingPayment.payment || {};

      if (!secret) {
        return cbk([503, 'CompleteSwapPaymentStillPending']);
      }

      return cbk(null, {
        funding_utxos: fundingUtxos.matching_outputs,
        invoice_id: parsedInvoice.id,
        payment_secret: secret,
        transaction_id: claimTransaction.id,
      });
    }],
  },
  returnResult({of: 'completedSwap'}, cbk));
};
