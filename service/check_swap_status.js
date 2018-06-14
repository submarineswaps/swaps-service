const asyncAuto = require('async/auto');
const {parseInvoice} = require('ln-service');

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
    [conf_wait_count]: <Confirmations to Wait Number> // With funding pending
    [output_index]: <Output Index Of Funding Output Number>
    [output_tokens]: <Output Tokens Value For Funding Output Number>
    [payment_secret]: <Payment Secret Hex String> // With claim present
    transaction_id: <Funding Transaction Id Hex String>
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
        console.log('FUNDING', funding);

        return cbk(null, {
          block: funding.block,
          output_index: funding.vout,
          output_tokens: funding.tokens,
          transaction_id: funding.id,
        });
      }

      return cbk();
    }],

    getConfirmationCount: ['swapElement', ({swapElement}, cbk) => {
      if (!swapElement || !swapElement.block) {
        return cbk();
      }

      console.log('FIND CONFIRMATION COUNT FOR BLOCK', swapElement.block);

      return cbk();
    }],

    // Current swap status
    getSwapStatus: ['swapElement', ({swapElement}, cbk) => {
      if (!swapElement) {
        return cbk([402, 'FundingNotFound']);
      }

      return cbk(null, {
        conf_wait_count: !!swapElement.payment_secret ? null : 1,
        output_index: swapElement.output_index,
        output_tokens: swapElement.output_tokens,
        payment_secret: swapElement.payment_secret,
        transaction_id: swapElement.transaction_id,
      });
    }],
  },
  returnResult({of: 'getSwapStatus'}, cbk));
};

