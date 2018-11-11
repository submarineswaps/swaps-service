const asyncAuto = require('async/auto');
const asyncEach = require('async/each');

const {deleteJsonFromCache} = require('./../cache');
const {parsePaymentRequest} = require('./../lightning');
const {serverSwapKeyPair} = require('./../service');
const {swapScriptDetails}= require('./../swaps');

/** Forget swap removes a swap from being watched. This should be used when a
  swap is deliberately canceled, or when the swap is known to be fully
  resolved.

  {
    cache: <Cache Type String>
    index: <Key Index Number>
    invoice: <BOLT 11 Invoice String>
    network: <Network Name String>
    script: <Redeem Script Hex String>
  }
*/
module.exports = ({cache, index, invoice, network, script}, cbk) => {
  return asyncAuto({
    // Check the arguments
    validate: cbk => {
      if (!cache) {
        return cbk([400, 'ExpectedCacheToForgetIn']);
      }

      if (!index) {
        return cbk([400, 'ExpectedIndex']);
      }

      if (!invoice) {
        return cbk([400, 'ExpectedInvoice']);
      }

      if (!network) {
        return cbk([400, 'ExpectedNetworkToForgetSwap']);
      }

      if (!script) {
        return cbk([400, 'ExpectedScript']);
      }

      return cbk();
    },

    // Derive the invoice id
    id: ['validate', ({}, cbk) => {
      try {
        return cbk(null, parsePaymentRequest({request: invoice}).id);
      } catch (e) {
        return cbk([400, 'ExpectedValidInvoice', e]);
      }
    }],

    // Derive the public key
    publicKey: ['validate', ({}, cbk) => {
      try {
        return cbk(null, serverSwapKeyPair({index, network}).public_key);
      } catch (e) {
        return cbk([500, 'FailedToDeriveSwapKeyPair', e]);
      }
    }],

    // Derive script details
    scriptDetails: ['validate', ({}, cbk) => {
      try {
        return cbk(null, swapScriptDetails({network, script}));
      } catch (e) {
        return cbk([400, 'ExpectedValidRedeemScript', e]);
      }
    }],

    // Eliminate the cached keys associated with a swap
    deleteCachedPublicKey: [
      'id',
      'publicKey',
      'scriptDetails',
      ({id, publicKey, scriptDetails}, cbk) =>
    {
      const cacheItmes = [
        {key: publicKey, type: 'swap_key'},
        {key: scriptDetails.p2sh_address, type: 'swap_address'},
        {key: scriptDetails.p2sh_p2wsh_address, type: 'swap_address'},
        {key: scriptDetails.p2wsh_address, type: 'swap_address'},
      ];

      return asyncEach(cacheItems, ({key, type}) => {
        return deleteJsonFromCache({cache, key, type}, cbk);
      },
      cbk);
    }],
  },
  returnResult({}, cbk));
};

