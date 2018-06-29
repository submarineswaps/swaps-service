const asyncAuto = require('async/auto');
const asyncMap = require('async/map');

const {address} = require('./../tokenslib');
const {addressDetails} = require('./../chain');
const getWatchedOutput = require('./get_watched_output');
const {networks} = require('./../tokenslib');
const {returnResult} = require('./../async-util');
const {Transaction} = require('./../tokenslib');

const {fromOutputScript} = address;

/** Return swap transactions detected in the outputs of a transaction.

  The type of swaps that can be detected in outputs are funding transactions.

  {
    cache: <Cache Type String>
    network: <Network Name String>
    transaction: <Transaction Hex String>
  }

  @returns via cbk
  {
    swaps: [{
      id: <Transaction Id Hex String>
      index: <Claim Key Index Number>
      invoice: <Invoice Id String>
      output: <Output Script Hex String>
      script: <Redeem Script Hex String>
      tokens: <Token Count Number>
      type: <Type String> 'funding'
      vout: <Output Index Number>
    }]
  }
*/
module.exports = ({cache, network, transaction}, cbk) => {
  return asyncAuto({
    // Validate arguments
    validate: cbk => {
      if (!cache) {
        return cbk([400, 'ExpectedCacheTypeForSwapCaching']);
      }

      if (!network) {
        return cbk([400, 'ExpectedNetworkToWatchForSwapOutput']);
      }

      if (!transaction) {
        return cbk([400, 'ExpectedTransaction']);
      }

      return cbk();
    },

    // Transaction id
    id: ['validate', ({}, cbk) => {
      try {
        return cbk(null, Transaction.fromHex(transaction).getId());
      } catch (e) {
        return cbk([400, 'ExpectedValidTransaction']);
      }
    }],

    // Derive transaction outputs
    outputs: ['validate', ({}, cbk) => {
      try {
        return cbk(null, Transaction.fromHex(transaction).outs);
      } catch (e) {
        return cbk([400, 'ExpectedValidTransaction']);
      }
    }],

    // Addresses associated with outputs, if any
    addresses: ['outputs', ({outputs}, cbk) => {
      if (!networks[network]) {
        return cbk([400, 'InvalidNetworkForSwapOutput']);
      }

      const outputAddresses = outputs.map(({script, value}, i) => {
        try {
          const address = fromOutputScript(script, networks[network]);

          return {
            address,
            index: i,
            output: script.toString('hex'),
            tokens: value,
            type: addressDetails({address, network}).type,
          };
        } catch (e) {
          return null;
        }
      });

      const scriptAddresses = outputAddresses
        .filter(n => !!n)
        .filter(({type}) => type === 'p2sh' || type === 'p2wsh');

      return cbk(null, scriptAddresses);
    }],

    // Addresses watched by the scanner
    watchedAddresses: ['addresses', 'id', ({addresses, id}, cbk) => {
      return asyncMap(addresses, ({address, index, output, tokens}, cbk) => {
        return getWatchedOutput({address, network, cache}, (err, res) => {
          if (!!err) {
            return cbk(err);
          }

          // Exit early when there is no associated swap with the address
          if (!res.swap) {
            return cbk();
          }

          // Exit early when the amount sent to the address isn't right
          if (res.swap.tokens !== tokens) {
            return cbk();
          }

          return cbk(null, {
            id,
            output,
            tokens,
            index: res.swap.index,
            invoice: res.swap.invoice,
            script: res.swap.script,
            type: res.swap.type,
            vout: index,
          });
        });
      },
      cbk);
    }],

    // Final set of found swaps
    swaps: ['watchedAddresses', ({watchedAddresses}, cbk) => {
      return cbk(null, {swaps: watchedAddresses.filter(swap => !!swap)});
    }],
  },
  returnResult({of: 'swaps'}, cbk));
};

