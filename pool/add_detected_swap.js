const {createHash} = require('crypto');

const asyncAuto = require('async/auto');

const {addJsonToCachedSet} = require('./../cache');
const {returnResult} = require('./../async-util');
const {swapScriptDetails} = require('./../swaps');

const cacheSwapElementMs = 1000 * 60 * 60 * 24 * 7;
const elementCount = 1; // Number of elements that can be added per call

/** Add a detected swap element to the pool set

  - A claim is a transaction input that executes the claim path of the swap
  - Funding is an output that pays to a swap address
  - A refund is a transaction input that executes the refund path of a swap

  The intended use case of this method is for swap detection methods to cache
  their findings in the pool. When swap elements are found, they are added to
  the set of elements related to a swap, identified by an invoice id.

  {
    cache: <Cache Type String>
    [claim]: {
      id: <Transaction Id String>
      invoice: <BOLT 11 Invoice String>
      network: <Network Name String>
      outpoint: <Outpoint String>
      preimage: <Preimage Hex String>
      script: <Redeem Script Hex String>
    },
    [funding]: {
      id: <Transaction Id String>
      index: <HD Seed Key Index Number>
      invoice: <BOLT 11 Invoice String>
      network: <Network Name String>
      output: <Output Script Hex String>
      script: <Redeem Script Hex String>
      tokens: <Output Token Count Number>
      vout: <Output Index Number>
    }
    id: <Invoice Id String>
    [refund]: {
      id: <Transaction Id String>
      invoice: <BOLT 11 Invoice String>
      network: <Network Name String>
      outpoint: <Spent Outpoint String>
      script: <Redeem Script Hex String>
    }
  }
*/
module.exports = ({cache, claim, id, funding, refund}, cbk) => {
  return asyncAuto({
    // Find the swap element
    element: cbk => {
      if ([claim, funding, refund].filter(n => !!n).length !== elementCount) {
        return cbk([400, 'ExpectedSwapElement']);
      }

      return cbk(null, claim || funding || refund);
    },

    // Check arguments
    validate: ['element', ({element}, cbk) => {
      if (!cache) {
        return cbk([400, 'ExpectedCacheType']);
      }

      if (!element.id) {
        return cbk([400, 'ExpectedSwapElementTransactionId']);
      }

      if (!element.invoice) {
        return cbk([400, 'ExpectedSwapElementInvoice', element]);
      }

      if (!element.network) {
        return cbk([400, 'ExpectedSwapElementNetwork']);
      }

      if (!element.script) {
        return cbk([400, 'ExpectedSwapElementRedeemScript']);
      }

      switch (element.type) {
      // Swap element is a claim input
      case 'claim':
        if (!element.outpoint) {
          return cbk([400, 'ExpectedClaimSpentOutpoint']);
        }

        if (!element.preimage) {
          return cbk([400, 'ExpectedClaimSwapPreimage']);
        }

        break;

      case 'funding':
        if (element.index === undefined) {
          return cbk([400, 'ExpectedFundingClaimKeyIndex']);
        }

        if (!element.network) {
          return cbk([400, 'ExpectedNetworkName']);
        }

        if (!element.output) {
          return cbk([400, 'ExpectedFundingOutputScript']);
        }

        if (element.tokens === undefined) {
          return cbk([400, 'ExpectedFundingTokensValue']);
        }

        if (element.vout === undefined) {
          return cbk([400, 'ExpectedFundingOutputIndex']);
        }

        break;

      case 'refund':
        if (!element.outpoint) {
          return cbk([400, 'ExpectedRefundSpentOutpoint']);
        }

        break;

      default:
        return cbk([400, 'UnexpectedSwapElementType', type]);
      }

      if (!id) {
        return cbk([400, 'ExpectedSwapId']);
      }

      return cbk();
    }],

    // Get timeout height of the swap
    swapDetails: ['element', 'validate', ({element}, cbk) => {
      try {
        return cbk(null, swapScriptDetails({script: element.script}));
      } catch (e) {
        return cbk([500, 'FailedToDecodeSwapScript']);
      }
    }],

    // Sort is the second part of a compound key that identifies a swap element
    sortComponent: ['element', 'validate', ({element}, cbk) => {
      switch (element.type) {
      case 'claim':
      case 'refund':
        return cbk(null, element.outpoint);

      case 'funding':
        return cbk(null, element.vout);

      default:
        return cbk([500, 'UnexpectedSwapElementType']);
      }
    }],

    // Sorting key is made up of a height plus a hash to create uniqueness
    sortKey: [
      'element',
      'sortComponent',
      'swapDetails',
      ({element, sortComponent, swapDetails}, cbk) =>
    {
      const components = [
        element.id, // Transaction id swap element is in
        element.network, // Network that swap tx is on
        element.script, // Redeem script of swap element
        element.type, // Type of swap element
        sortComponent, // Uniquely identifying element component
      ];

      const hash = createHash('sha256').update(components.join('/'));
      const height = swapDetails.timelock_block_height;

      return cbk(null, [height, hash.digest('hex')].join('-'));
    }],

    // Add the swap to the cached set
    addToCache: ['element', 'sortKey', ({element, sortKey}, cbk) => {
      return addJsonToCachedSet({
        cache,
        key: id,
        ms: cacheSwapElementMs,
        sort: sortKey,
        type: 'swap_elements',
        value: element,
      },
      cbk);
    }],
  },
  returnResult({}, cbk));
};

