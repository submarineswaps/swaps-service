const asyncAuto = require('async/auto');

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
    [conf_wait_count]: <Confirmations to Wait Number>
    [output_index]: <Output Index Number>
    [output_tokens]: <Output Tokens Number>
    [payment_secret]: <Payment Secret Hex String>
    transaction_id: <Transaction Id Hex String>
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

    // Go figure out the swap status by pulling blocks and looking for the swap
    getSwapStatus: ['validate', ({}, cbk) => {
      return getSwapStatus({cache, invoice, script}, cbk);
    }],
  },
  returnResult({of: 'getSwapStatus'}, cbk));
};

