const asyncAuto = require('async/auto');
const {parseInvoice} = require('ln-service');

const confirmWaitTime = require('./confirm_wait_time');
const {getConfirmationCount} = require('./../chain');
const getDetectedSwaps = require('./../pool/get_detected_swaps');
const getSwapStatus = require('./get_swap_status');
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

    // Invoice id
    id: ['validate', ({}, cbk) => {
      try {
        return cbk(null, parseInvoice({invoice}).id);
      } catch (e) {
        return cbk([400, 'FailedToParseSwapInvoice', e]);
      }
    }],

    // See if the swap is in the swap pool
    getSwapFromPool: ['id', ({id}, cbk) => getDetectedSwaps({cache, id}, cbk)],

    // See if we have a related swap element
    swapElement: ['getSwapFromPool', ({getSwapFromPool}, cbk) => {
      const [claim] = getSwapFromPool.claim;
      const [funding] = getSwapFromPool.funding;

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

      return cbk();
    }],

    // Determine confirmation count
    getBlockInfo: ['swapElement', ({swapElement}, cbk) => {
      // Exit early when there is no need to look up block details
      if (!swapElement || !swapElement.block) {
        return cbk();
      }

      return getBlockHeader({network, block: swapElement.block}, cbk);
    }],

    // Determine wait time still necessary to confirm the swap
    waitTime: ['getBlockInfo', ({getBlockInfo}, cbk) => {
      const conf = !getBlockInfo ? 0 : getBlockInfo.current_confirmation_count;

      return cbk(null, confirmWaitTime({current_confirmations: conf}));
    }],

    // Current swap status
    getSwapStatus: [
      'swapElement',
      'waitTime',
      ({swapElement, waitTime}, cbk) =>
    {
      if (!swapElement) {
        return cbk([402, 'FundingNotFound']);
      }

      return cbk(null, {
        conf_wait_count: !!waitTime ? waitTime.remaining_confirmations : null,
        output_index: swapElement.output_index,
        output_tokens: swapElement.output_tokens,
        payment_secret: swapElement.payment_secret,
        transaction_id: swapElement.transaction_id,
      });
    }],
  },
  returnResult({of: 'getSwapStatus'}, cbk));
};

