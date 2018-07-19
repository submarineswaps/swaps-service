const {createHash} = require('crypto');

const asyncAuto = require('async/auto');
const {getInvoice} = require('ln-service');
const {parseInvoice} = require('ln-service');
const {shuffle} = require('lodash');

const swapParameters = require('./swap_parameters');
const {getConfirmationCount} = require('./../chain');
const {getBlockPlacement} = require('./../blocks');
const getDetectedSwaps = require('./../pool/get_detected_swaps');
const getSwapStatus = require('./get_swap_status');
const {lightningDaemon} = require('./../lightning');
const {returnResult} = require('./../async-util');

/** Check the status of a swap

  This will attempt to execute the swap if it detects a funded swap.

  {
    cache: <Cache Name String>
    invoice: <Lightning Invoice String>
    network: <Network Name String>
    script: <Redeem Script Hex String>
  }

  @returns via cbk
  {
    [output_index]: <Output Index Of Funding Output Number>
    [output_tokens]: <Output Tokens Value For Funding Output Number>
    [payment_secret]: <Payment Secret Hex String> // With claim present
    transaction_id: <Funding Transaction Id Hex String>
    [wait_time_ms]: <Time To Wait Number> // With funding pending
  }
*/
module.exports = ({cache, invoice, network, script}, cbk) => {
  return asyncAuto({
    // Check arguments
    validate: cbk => {
      if (!cache) {
        return cbk([400, 'ExpectedCacheForSwapDetails']);
      }

      if (!invoice) {
        return cbk([400, 'ExpectedInvoice']);
      }

      if (!network) {
        return cbk([400, 'ExpectedNetwork']);
      }

      if (!script) {
        return cbk([400, 'ExpectedRedeemScript']);
      }

      return cbk();
    },

    parseInvoice: ['validate', ({}, cbk) => {
      try {
        return cbk(null, parseInvoice({invoice}));
      } catch (e) {
        return cbk([400, 'FailedToParseSwapInvoice', e]);
      }
    }],

    // Invoice id
    id: ['parseInvoice', ({parseInvoice}, cbk) => {
      if (!invoice.id){
        return cbk([400, 'FailedToParseSwapInvoice', e]);
      } else {
        return cbk(null, invoice.id)
      }
    }],

    // Get swap attempt in progress
    getSwapAttempt: ['id', 'parseInvoice', ({id, parseInvoice}, cbk) => {
      let lnd;

      try {
        lnd = lightningDaemon({'network': parseInvoice.network});
      } catch (e) {
        return cbk(null, [500, 'FailedToCreateLndConnection']);
      }

      const swapId = Buffer.from(id, 'hex');

      const attemptId = createHash('sha256').update(swapId).digest('hex');

      return getInvoice({lnd, id: attemptId}, (err, details) => {
        if (!!err) {
          return cbk();
        }

        return cbk(null, details.expires_at);
      });
    }],

    // Check for swap attempt failure
    checkSwapAttempt: ['getSwapAttempt', ({getSwapAttempt}, cbk) => {
      if (!getSwapAttempt) {
        return cbk();
      }

      if (new Date().toISOString() > getSwapAttempt) {
        return cbk([410, 'PaymentFailed']);
      }

      return cbk();
    }],

    // See if the swap is in the swap pool
    getSwapFromPool: ['id', ({id}, cbk) => getDetectedSwaps({cache, id}, cbk)],

    // See if we have a related swap element
    swapElement: ['getSwapFromPool', ({getSwapFromPool}, cbk) => {
      const elements = getSwapFromPool;

      const [claim] = elements.claim;
      const [funding] = elements.funding.filter(({block}) => !!block);
      const [unconfirmed] = elements.funding.filter(({block}) => !block);

      if (!!claim) {
        return cbk(null, {
          payment_secret: claim.preimage,
          transaction_id: claim.outpoint.split(':')[0],
        });
      }

      if (!!funding) {
        return cbk(null, {
          block: funding.block,
          output_index: funding.vout,
          output_tokens: funding.tokens,
          transaction_id: funding.id,
        });
      }

      if (!!unconfirmed) {
        return cbk(null, {
          output_index: unconfirmed.vout,
          output_tokens: unconfirmed.tokens,
          transaction_id: unconfirmed.id,
        });
      }

      return cbk();
    }],

    // Determine confirmation count
    getBlockInfo: ['swapElement', ({swapElement}, cbk) => {
      // Exit early when there is no need to look up block details
      if (!swapElement || !swapElement.block) {
        return cbk();
      }

      const {block} = swapElement;

      return getBlockPlacement({block, cache, network}, cbk);
    }],

    // Determine wait time still necessary to confirm the swap
    remainingConfs: ['getBlockInfo', ({getBlockInfo}, cbk) => {
      const conf = !getBlockInfo ? 0 : getBlockInfo.current_confirmation_count;

      try {
        const requiredFundingConfs = swapParameters({network}).funding_confs;

        return cbk(null, Math.max(0, requiredFundingConfs - conf));
      } catch (e) {
        return cbk([500, 'FailedToDetermineWaitConfirmations', e]);
      }
    }],

    // Current swap status
    getSwapStatus: [
      'remainingConfs',
      'swapElement',
      ({remainingConfs, swapElement}, cbk) =>
    {
      if (!swapElement) {
        return cbk([402, 'FundingNotFound']);
      }

      return cbk(null, {
        conf_wait_count: !!remainingConfs ? remainingConfs : null,
        output_index: swapElement.output_index,
        output_tokens: swapElement.output_tokens,
        payment_secret: swapElement.payment_secret,
        transaction_id: swapElement.transaction_id,
      });
    }],
  },
  returnResult({of: 'getSwapStatus'}, cbk));
};

