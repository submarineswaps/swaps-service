const asyncAuto = require('async/auto');
const asyncMap = require('async/map');
const {groupBy} = require('lodash');
const {returnResult} = require('asyncjs-util');

const {getCachedSetJson} = require('./../cache');

/** Get the swap elements that correspond to a swap, identified by an invoice
  id.

  {
    cache: <Cache Type String>
    id: <Invoice Id String>
  }

  @returns via cbk
  {
    [attempt]: [{
      date: <ISO 8601 Date String>
      hops: [<Channel Short Id String>]
      id: <Id String>
      type: <Type String> 'attempt'
    }]
    [claim]: [{
      [block]: <Block Id Hex String>
      id: <Transaction Id String>
      network: <Network Name String>
      outpoint: <Outpoint String>
      preimage: <Preimage Hex String>
      script: <Redeem Script Hex String>
      type: <Type String> 'claim'
    }],
    [funding]: [{
      [block]: <Block Id Hex String>
      id: <Transaction Id String>
      index: <HD Seed Key Index Number>
      invoice: <BOLT 11 Invoice String>
      network: <Network Name String>
      output: <Output Script Hex String>
      script: <Redeem Script Hex String>
      tokens: <Output Token Count Number>
      type: <Type String> 'funding'
      vout: <Output Index Number>
    }]
    [refund]: {
      [block]: <Block Id Hex String>
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

    // Atempts for the invoice
    attempt: ['elements', ({elements}, cbk) => {
      const attempts = elements.attempt || [];

      return asyncMap(attempts, ({date, hops, id, type}, cbk) => {
        if (!date) {
          return cbk([500, 'ExpectedAttemptDate']);
        }

        if (!Array.isArray(hops) || !hops.length) {
          return cbk([500, 'ExpectedAttemptHops']);
        }

        if (!id) {
          return cbk([500, 'ExpectedAttemptId']);
        }

        if (type !== 'attempt') {
          return cbk([500, 'ExpectedAttemptType']);
        }

        return cbk(null, {date, hops, id});
      },
      cbk);
    }],

    // Claims in swap elements
    claim: ['elements', ({elements}, cbk) => {
      return asyncMap(elements.claim || [], (claim, cbk) => {
        const {block} = claim;
        const {id} = claim;
        const {invoice} = claim;
        const {network} = claim;
        const {outpoint} = claim;
        const {preimage} = claim;
        const {script} = claim;
        const {type} = claim;

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

        if (type !== 'claim') {
          return cbk([500, 'ExpectedClaimType']);
        }

        return cbk(null, {
          block,
          id,
          invoice,
          network,
          outpoint,
          preimage,
          script,
          type,
        });
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

        if (funding.type !== 'funding') {
          return cbk([500, 'ExpectedFundingType']);
        }

        if (!funding.tokens) {
          return cbk([500, 'ExpectedFundingTokens']);
        }

        if (funding.vout === undefined) {
          return cbk([500, 'ExpectedFundingVout']);
        }

        return cbk(null, {
          block: funding.block,
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
        const {block} = refund;
        const {id} = refund;
        const {invoice} = refund;
        const {network} = refund;
        const {outpoint} = refund;
        const {script} = refund;
        const {type} = refund;

        if (!id) {
          return cbk([500, 'ExpectedRefundTransactionId']);
        }

        if (!invoice) {
          return cbk([500, 'ExpectedRefundInvoice']);
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

        if (type !== 'refund') {
          return cbk([500, 'ExpectedRefundType']);
        }

        return cbk(null, {
          block,
          id,
          invoice,
          network,
          outpoint,
          script,
          type,
        });
      },
      cbk);
    }],

    // Final swaps result 
    swaps: [
      'attempt',
      'claim',
      'funding',
      'refund',
      ({attempt, claim, funding, refund}, cbk) =>
    {
      return cbk(null, {attempt, claim, funding, refund});
    }],
  },
  returnResult({of: 'swaps'}, cbk));
};

