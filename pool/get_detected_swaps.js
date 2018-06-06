const asyncAuto = require('async/auto');
const asyncMap = require('async/map');
const {groupBy} = require('lodash');

const {getCachedSetJson} = require('./../cache');
const {returnResult} = require('./../async-util');

/** Get the swap elements that correspond to a swap, identified by an invoice
  id.

  {
    cache: <Cache Type String>
    id: <Invoice Id String>
  }

  @returns via cbk
  {    
    claim: [{
      id: <Transaction Id String>
      network: <Network Name String>
      outpoint: <Outpoint String>
      preimage: <Preimage Hex String>
      script: <Redeem Script Hex String>
    }],
    funding: [{
      id: <Transaction Id String>
      index: <HD Seed Key Index Number>
      invoice: <BOLT 11 Invoice String>
      network: <Network Name String>
      output: <Output Script Hex String>
      script: <Redeem Script Hex String>
      tokens: <Output Token Count Number>
      type: <Type String> 'refund'
      vout: <Output Index Number>
    }]
    refund: {
      id: <Transaction Id String>
      network: <Network Name String>
      outpoint: <Spent Outpoint String>
      script: <Redeem Script Hex String>
      type: <Type String> 'refund'
    }
  }
*/
module.exports = ({cache, id}, cbk) => {
  return asyncAuto({
    // Check arguments
    validate: cbk => {
      if (!cache) {
        return cbk([400, 'ExpectedCacheTypeForCachedSwapElementsLookup']);
      }

      if (!id) {
        return cbk([400, 'ExpectedInvoiceIdForRelatedSwapElements']);
      }

      return cbk();
    },

    // Get all the cached swaps out of the set
    getCachedSwaps: ['validate', ({}, cbk) => {
      return getCachedSetJson({cache, key: id, type: 'swap_elements'}, cbk);
    }],

    // Swap elements, grouped by type
    elements: ['getCachedSwaps', ({getCachedSwaps}, cbk) => {
      return cbk(null, groupBy(getCachedSwaps.items, 'type'));
    }],

    // Claims in swap elements
    claim: ['elements', ({elements}, cbk) => {
      return asyncMap(elements.claim || [], (claim, cbk) => {
        const {id} = claim;
        const {network} = claim;
        const {outpoint} = claim;
        const {preimage} = claim;
        const {script} = claim;

        if (!id) {
          return cbk([500, 'ExpectedClaimId']);
        }

        if (!network) {
          return cbk([500, 'ExpectedClaimNetwork']);
        }

        if (!outpoint) {
          return cbk([500, 'ExpectedClaimOutpoint']);
        }

        if (!preimage) {
          return cbk([500, 'ExpectedClaimPreimage']);
        }

        if (!script) {
          return cbk([500, 'ExpectedClaimScript']);
        }

        return cbk(null, {id, network, outpoint, preimage, script});
      },
      cbk);
    }],

    // Funding inputs
    funding: ['elements', ({elements}, cbk) => {
      return asyncMap(elements.funding || [], (funding, cbk) => {
        if (!funding.id) {
          return cbk([500, 'ExpectedFundingTransactionId']);
        }

        if (!funding.index) {
          return cbk([500, 'ExpectedFundingKeyIndex'])
        }

        if (!funding.invoice) {
          return cbk([500, 'ExpectedFundingSwapInvoice']);
        }

        if (!funding.network) {
          return cbk([500, 'ExpectedFundingChainNetwork']);
        }

        if (!funding.output) {
          return cbk([500, 'ExpectedFundingOutputScript']);
        }

        if (!funding.script) {
          return cbk([500, 'ExpectedFundingRedeemScript']);
        }

        if (!funding.tokens) {
          return cbk([500, 'ExpectedFundingTokens']);
        }

        if (funding.vout === undefined) {
          return cbk([500, 'ExpectedFundingVout']);
        }

        return cbk(null, {
          id: funding.id,
          index: funding.index,
          invoice: funding.invoice,
          network: funding.network,
          output: funding.output,
          script: funding.script,
          tokens: funding.tokens,
          type: funding.type,
          vout: funding.vout,
        });
      },
      cbk);
    }],

    // Refund inputs for the swap
    refund: ['elements', ({elements}, cbk) => {
      return asyncMap(elements.refund || [], (refund, cbk) => {
        const {id} = refund;
        const {network} = refund;
        const {outpoint} = refund;
        const {script} = refund;

        if (!id) {
          return cbk([500, 'ExpectedRefundTransactionId']);
        }

        if (!network) {
          return cbk([500, 'ExpectedRefundTransactionNetwork']);
        }

        if (!outpoint) {
          return cbk([500, 'ExpectedRefundSpendOutpoint']);
        }

        if (!script) {
          return cbk([500, 'ExpectedRefundRedeemScript']);
        }

        return cbk(null, {id, network, outpoint, script});
      },
      cbk);
    }],

    // Final swaps result 
    swaps: ['claim', 'funding', 'refund', ({claim, funding, refund}, cbk) => {
      return cbk(null, {claim, funding, refund});
    }],
  },
  returnResult({of: 'swaps'}, cbk));
};

