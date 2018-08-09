const asyncAuto = require('async/auto');
const asyncFilter = require('async/filter');
const asyncTimeout = require('async/timeout');

const {getRecentChainTip} = require('./../blocks');
const isConfigured = require('./is_configured');
const {networks} = require('./../tokenslib');
const {returnResult} = require('./../async-util');

const active = {};
const nets = Object.keys(networks);
const timeout = 1000 * 30;

/** Get networks that are currently active and available for swaps

  {}

  @returns via cbk
  {
    networks: [{
      network: <Network Name String>
    }]
  }
*/
module.exports = ({}, cbk) => {
  return asyncAuto({
    // Configured networks
    configured: cbk => {
      return cbk(null, nets.filter(network => isConfigured({network})));
    },

    // Confirm chain backends have data
    online: ['configured', ({configured}, cbk) => {
      const hasCheckedActive = Object.keys(active).length;

      return asyncFilter(configured, (network, cbk) => {
        if (!!hasCheckedActive && active[network]) {
          return cbk(null, true);
        }

        const getChainTip = ({network}, cbk) => {
          return getRecentChainTip({network}, err => cbk(null, !err));
        };

        asyncTimeout(getChainTip, timeout)({network}, (err, isOn) => {
          if (!!err) {
            return;
          }

          active[network] = isOn;

          return !hasCheckedActive ? cbk(null, isOn) : null;
        });

        if (!!hasCheckedActive) {
          return cbk(null, false);
        }
      },
      cbk);
    }],

    // Final networks list
    networks: ['online', ({online}, cbk) => cbk(null, {networks: online})],
  },
  returnResult({of: 'networks'}, cbk));
};

