const asyncAuto = require('async/auto');
const asyncFilter = require('async/filter');

const {getRecentChainTip} = require('./../blocks');
const isConfigured = require('./is_configured');
const {networks} = require('./../tokenslib');
const {returnResult} = require('./../async-util');

const nets = Object.keys(networks);

/** Get networks that are currently active and available for swaps

  {
    cache: <Cache Type String>
  }

  @returns via cbk
  {
    networks: [{
      network: <Network Name String>
    }]
  }
*/
module.exports = ({cache}, cbk) => {
  return asyncAuto({
    // Configured networks
    configured: cbk => {
      return cbk(null, nets.filter(network => isConfigured({network})));
    },

    // Check arguments
    validate: cbk => {
      if (!cache) {
        return cbk([400, 'ExpectedCacheTypeForActiveNetworksCheck']);
      }

      return cbk();
    },

    // Confirm chain backends have data
    online: ['configured', 'validate', ({configured}, cbk) => {
      return asyncFilter(configured, (network, cbk) => {
        return getRecentChainTip({cache, network}, err => cbk(null, !err));
      },
      cbk);
    }],

    // Final networks list
    networks: ['online', ({online}, cbk) => cbk(null, {networks: online})],
  },
  returnResult({of: 'networks'}, cbk));
};

