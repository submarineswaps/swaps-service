const asyncAuto = require('async/auto');
const {returnResult} = require('asyncjs-util');

const chainRpc = require('./call_chain_rpc');
const {getBlockHashAtHeight} = require('./conf/rpc_commands');
const getBlockHeader = require('./get_block_header');
const {getUtxo} = require('./conf/rpc_commands');

const tokensPerBigUnit = 1e8;

/** Get unspent transaction output

  {
    id: <Transaction Id String>
    network: <Network Name String>
    vout: <Transaction Vout Number>
  }

  @returns via cbk or Promise
  {
    [utxo]: {
      [block]: <Block Id Hex String>
      [conf_count]: <Confirmations Count Number>
      [output_script]: <Output Script Hex String>
      tokens: <Output Value Tokens Number>
    }
  }
*/
module.exports = ({id, network, vout}, cbk) => {
  return new Promise((resolve, reject) => {
    return asyncAuto({
      // Check arguments
      validate: cbk => {
        if (!id) {
          return cbk([400, 'ExpectedTransactionIdForUtxoDetails']);
        }

        if (!network) {
          return cbk([400, 'ExpectedNetworkToLookForUtxoDetails']);
        }

        if (vout === undefined) {
          return cbk([400, 'ExpectedOutputIndexToLookForUtxoDetails']);
        }

        return cbk();
      },

      // Get utxo
      getUtxo: ['validate', ({}, cbk) => {
        return chainRpc({
          network,
          cmd: getUtxo,
          params: [id, vout, false],
        },
        (err, utxo) => {
          if (!!err) {
            return cbk(err);
          }

          if (!utxo) {
            return cbk(null, {});
          }

          if (!utxo.scriptPubKey) {
            return cbk([503, 'ExpectedScriptPubKeyInOutput']);
          }

          if (!utxo.scriptPubKey.hex) {
            return cbk([503, 'ExpectedScriptPubKeyHexInOutput']);
          }

          if (utxo.value === undefined) {
            return cbk([503, 'ExpectedUtxoValueInOutput']);
          }

          return cbk(null, {
            chain_tip_block: utxo.bestblock,
            utxo: {
              conf_count: utxo.confirmations,
              output_script: utxo.scriptPubKey.hex,
              tokens: utxo.value * tokensPerBigUnit,
            },
          });
        });
      }],

      // Get chain tip height
      getTipHeight: ['getUtxo', ({getUtxo}, cbk) => {
        if (!getUtxo.chain_tip_block || !getUtxo.utxo.conf_count) {
          return cbk();
        }

        return getBlockHeader({
          network,
          block: getUtxo.chain_tip_block,
        },
        cbk);
      }],

      // Get confirmation block id
      getBlock: ['getTipHeight', 'getUtxo', ({getTipHeight, getUtxo}, cbk) => {
        if (!getTipHeight || !getTipHeight.height || !getUtxo) {
          return cbk();
        }

        const confs = getTipHeight.height - getUtxo.utxo.conf_count;

        return chainRpc({
          network,
          cmd: getBlockHashAtHeight,
          params: [confs + [getUtxo.utxo].length],
        },
        (err, block) => {
          if (!!err) {
            return cbk([503, 'UnexpectedErrorGettingBlockHash', {err}]);
          }

          if (!block) {
            return cbk([503, 'ExpectedResponseForGetBlockHashRequst']);
          }

          return cbk(null, block || undefined);
        });
      }],

      // Final UTXO details
      utxo: ['getBlock', 'getUtxo', ({getBlock, getUtxo}, cbk) => {
        if (!getUtxo.utxo) {
          return cbk(null, {});
        }

        const utxo = {
          block: getBlock || undefined,
          conf_count: getUtxo.utxo.conf_count || undefined,
          output_script: getUtxo.utxo.output_script,
          tokens: getUtxo.utxo.tokens,
        };

        return cbk(null, {utxo});
      }],
    },
    returnResult({reject, resolve, of: 'utxo'}, cbk));
  });
};
