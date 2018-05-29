const asyncAuto = require('async/auto');
const asyncEach = require('async/each');
const {parseInvoice} = require('ln-service');

const {lightningDaemon} = require('./../lightning');
const {returnResult} = require('./../async-util');
const serverSwapKeyPair = require('./../service/server_swap_key_pair');
const {setJsonInCache} = require('./../cache');
const {swapScriptDetails} = require('./../swaps');

const swapTimeoutMs = 1000 * 60 * 60 * 24 * 7;

/** Add a swap output to watch out for.

  When we see an output, we can check on its output script to see if we are
  watching for it. If it matches one we're looking for, we need to know the
  associated swap info in order to claim it.

  {
    cache: <Cache Type String>
    index: <Server Claim Key Number>
    invoice: <BOLT 11 Invoice String>
    network: <Network Name String>
    script: <Redeem Script Hex String>
  }
*/
module.exports = ({cache, index, invoice, network, script}, cbk) => {
  return asyncAuto({
    // Validate arguments
    validate: cbk => {
      if (!cache) {
        return cbk([400, 'ExpectedCacheTypeForWatchStorage']);
      }

      if (!index) {
        return cbk([400, 'ExpectedKeyIndex']);
      }

      if (!invoice) {
        return cbk([400, 'ExpectedInvoice']);
      }

      if (!network) {
        return cbk([400, 'ExpectedNetwork']);
      }

      if (!script) {
        return cbk([400, 'ExpectedScript']);
      }

      return cbk();
    },

    // Derive the public key
    publicKey: ['validate', ({}, cbk) => {
      try {
        return cbk(null, serverSwapKeyPair({index, network}).public_key);
      } catch (e) {
        return cbk([500, 'FailedToDeriveSwapKeyPair', e]);
      }
    }],

    // Derive the invoice id
    id: ['validate', ({}, cbk) => {
      try {
        return cbk(null, parseInvoice({invoice}).id);
      } catch (e) {
        return cbk([400, 'ExpectedValidInvoice', e]);
      }
    }],

    // Derive script details
    scriptDetails: ['validate', ({}, cbk) => {
      try {
        return cbk(null, swapScriptDetails({redeem_script: script}));
      } catch (e) {
        return cbk([400, 'ExpectedValidRedeemScript', e]);
      }
    }],

    // Cache the swap output details
    cacheSwapOutput: [
      'id',
      'publicKey',
      'scriptDetails',
      ({id, publicKey, scriptDetails}, cbk) =>
    {
      const cacheEntries = [
        // Cache the invoice related to the input
        {
          key: id,
          ms: swapTimeoutMs,
          type: 'invoice',
          value: {invoice},
        },
        // Cache the p2sh address. Useful on networks that don't support SW
        {
          key: scriptDetails.p2sh_address,
          ms: swapTimeoutMs,
          type: 'swap_address',
          value: {id, script},
        },
        // Cache the p2sh nested p2wsh address. Default on SW networks
        {
          key: scriptDetails.p2sh_p2wsh_address,
          ms: swapTimeoutMs,
          type: 'swap_address',
          value: {id, script},
        },
        // Cache the p2wsh address. On SW networks, most efficient
        {
          key: scriptDetails.p2wsh_address,
          ms: swapTimeoutMs,
          type: 'swap_address',
          value: {id, script},
        },
        // Cache the public key association with a seed index
        {
          key: publicKey,
          ms: swapTimeoutMs,
          type: 'swap_key',
          value: {index},
        },
      ];

      return asyncEach(cacheEntries, ({key, ms, type, value}, cbk) => {
        return setJsonInCache({cache, key, ms, type, value}, cbk);
      },
      cbk);
    }],
  },
  returnResult({}, cbk));
};

