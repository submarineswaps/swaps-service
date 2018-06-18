const asyncAuto = require('async/auto');

const {getJsonFromCache} = require('./../cache');
const {returnResult} = require('./../async-util');
const {swapScriptDetails} = require('./../swaps');

/** Get details about a watched output

  {
    cache: <Cache Type String>
    address: <Address String>
    network: <Network Name String>
  }

  @returns via cbk
  {
    [swap]: {
      index: <Claim Key Index Number>
      invoice: <BOLT 11 Invoice String>
      script: <Output Redeem Script>
      type: <Type String> 'funding'
    }
  }
*/
module.exports = ({address, cache, network}, cbk) => {
  return asyncAuto({
    // Check arguments
    validate: cbk => {
      if (!address) {
        return cbk([400, 'ExpectedAddress']);
      }

      if (!cache) {
        return cbk([400, 'ExpectedCacheTypeForWatchedOutput']);
      }

      if (!network) {
        return cbk([400, 'ExpectedNetworkForWatchedOutput']);
      }

      return cbk();
    },

    // Find cached address
    getCachedAddress: ['validate', ({}, cbk) => {
      return getJsonFromCache({
        cache,
        key: address,
        type: 'swap_address',
      },
      (err, res) => {
        if (!!err) {
          return cbk(err);
        }

        if (!res || !res.id || !res.script) {
          return cbk();
        }

        return cbk(null, {id: res.id, script: res.script});
      });
    }],

    // Derive the claim public key 
    swapClaimPublicKey: ['getCachedAddress', ({getCachedAddress}, cbk) => {
      if (!getCachedAddress) {
        return cbk();
      }

      const {script} = getCachedAddress;

      try {
        const scriptDetails = swapScriptDetails({network, script});

        return cbk(null, scriptDetails.destination_public_key);
      } catch (e) {
        // Exit early and do not pass along errors.
        return cbk();
      }
    }],

    // Find the public key id
    getClaimKeyIndex: ['swapClaimPublicKey', ({swapClaimPublicKey}, cbk) => {
      if (!swapClaimPublicKey) {
        return cbk();
      }

      return getJsonFromCache({
        cache,
        key: swapClaimPublicKey,
        type: 'swap_key',
      },
      (err, res) => {
        if (!!err) {
          return cbk(err);
        }

        if (!res || !res.index) {
          return cbk();
        }

        return cbk(null, {index: res.index});
      });
    }],

    // Find cached invoice
    getCachedInvoice: ['getCachedAddress', ({getCachedAddress}, cbk) => {
      // Exit early when there is no hit for the cached address
      if (!getCachedAddress) {
        return cbk();
      }

      return getJsonFromCache({
        cache,
        key: getCachedAddress.id,
        type: 'invoice',
      },
      (err, res) => {
        if (!!err) {
          return cbk(err);
        }

        if (!res || !res.invoice) {
          return cbk();
        }

        return cbk(null, {invoice: res.invoice});
      });
    }],

    // Final swap details
    swap: [
      'getCachedAddress',
      'getCachedInvoice',
      'getClaimKeyIndex',
      ({getCachedAddress, getCachedInvoice, getClaimKeyIndex}, cbk) =>
    {
      if (!getClaimKeyIndex || !getCachedAddress || !getCachedInvoice) {
        return cbk(null, {});
      }

      return cbk(null, {
        swap: {
          index: getClaimKeyIndex.index,
          invoice: getCachedInvoice.invoice,
          script: getCachedAddress.script,
          type: 'funding',
        }
      });
    }],
  },
  returnResult({of: 'swap'}, cbk));
};

