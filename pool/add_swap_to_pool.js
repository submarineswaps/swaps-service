const asyncAuto = require('async/auto');

const addDetectedSwap = require('./add_detected_swap');
const getDetectedSwaps = require('./get_detected_swaps');
const getSwapStatus = require('./../service/get_swap_status');
const {parsePaymentRequest} = require('./../lightning');
const {returnResult} = require('./../async-util');

/** Add a swap to the pool

  This will also attempt to execute a swap if a funding transaction is detected

  cache: <Cache Type String>
  swap: {
    [block]: <Block Id Hex String>
    id: <Transaction Id String>
    [index]: <HD Seed Key Index Number>
    invoice: <BOLT 11 Invoice String>
    network: <Network Name String>
    [output]: <Output Script Hex String>
    [outpoint]: <Outpoint String>
    [preimage]: <Preimage Hex String>
    script: <Redeem Script Hex String>
    [tokens]: <Output Token Count Number>
    type: <Type String> 'claim|funding|refund'
    [vout]: <Output Index Number>
  }
*/
module.exports = ({cache, swap}, cbk) => {
  return asyncAuto({
    // Check arguments
    validate: cbk => {
      if (!cache) {
        return cbk([400, 'ExpectedCacheForPoolAddition']);
      }

      if (!swap) {
        return cbk([400, 'ExpectedSwapToAddToPool']);
      }

      return cbk();
    },

    // Pull out the claim element
    claim: ['validate', ({}, cbk) => {
      if (swap.type !== 'claim') {
        return cbk();
      }

      return cbk(null, {
        block: swap.block,
        id: swap.id,
        invoice: swap.invoice,
        network: swap.network,
        outpoint: swap.outpoint,
        preimage: swap.preimage,
        script: swap.script,
        type: swap.type,
      });
    }],

    // Pull out funding element
    funding: ['validate', ({}, cbk) => {
      if (swap.type !== 'funding') {
        return cbk();
      }

      return cbk(null, {
        block: swap.block,
        id: swap.id,
        index: swap.index,
        invoice: swap.invoice,
        network: swap.network,
        output: swap.output,
        script: swap.script,
        tokens: swap.tokens,
        type: swap.type,
        vout: swap.vout,
      });
    }],

    // Pull out refund element
    refund: ['validate', ({}, cbk) => {
      if (swap.type !== 'refund') {
        return cbk();
      }

      return cbk(null, {
        block: swap.block,
        id: swap.id,
        index: swap.index,
        invoice: swap.invoice,
        network: swap.network,
        outpoint: swap.outpoint,
        script: swap.script,
        type: swap.type,
      });
    }],

    // Parse out the invoice to get the invoice id
    invoice: [
      'claim',
      'funding',
      'refund',
      ({claim, funding, refund}, cbk) =>
    {
      const element = claim || funding || refund;

      if (!element) {
        return cbk([400, 'ExpectedSwapElement']);
      }

      const {invoice} = swap;

      try {
        return cbk(null, parsePaymentRequest({request: invoice}));
      } catch (e) {
        return cbk([400, 'FailedParsingInvoiceWhenAddingSwapToPool']);
      }
    }],

    // Invoice id is the id of the swap
    id: ['invoice', ({invoice}, cbk) => cbk(null, invoice.id)],

    // Add the swap to the pool
    addSwap: [
      'claim',
      'funding',
      'id',
      'refund',
      ({claim, funding, id, refund}, cbk) =>
    {
      return addDetectedSwap({cache, claim, funding, id, refund}, cbk);
    }],

    // Get the previously detected swap elements for this invoice
    getDetectedSwaps: ['addSwap', 'funding', 'id', ({funding, id}, cbk) => {
      if (!funding) {
        return cbk()
      }

      return getDetectedSwaps({cache, id}, cbk);
    }],

    // Check on funding swap status to see if it needs to be claimed
    checkForSwapExecution: [
      'funding',
      'getDetectedSwaps',
      ({funding, getDetectedSwaps}, cbk) =>
    {
      // Exit early when this is not a new funding update
      if (!funding) {
        return cbk();
      }

      // Exit early when the swap is already being claimed
      if (!!getDetectedSwaps.claim.length) {
        return cbk();
      }

      const {block} = funding;
      const {id} = funding;
      const {invoice} = funding;
      const {network} = funding;
      const {script} = funding;

      return getSwapStatus({block, cache, id, invoice, network, script}, cbk);
    }],
  },
  returnResult({}, cbk));
};

