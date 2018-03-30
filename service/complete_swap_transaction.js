const asyncAuto = require('async/auto');

const {broadcastTransaction} = require('./../chain');
const {claimTransaction} = require('./../swaps');
const {createAddress} = require('./../chain');
const {getBlockchainInfo} = require('./../chain');
const {getChainFeeRate} = require('./../chain');
const {getFee} = require('./../chain');
const {payInvoice} = require('./../lightning');
const {returnResult} = require('./../async-util');
const {swapScriptInTransaction} = require('./../swaps');

/** Complete a swap transaction

  {
    invoice: <Bolt 11 Invoice String>
    network: <Network Name String>
    redeem_script: <Redeem Script Hex String>
    private_key: <Private Key WIF String>
    transaction: <Funding Transaction Hex String>
  }

  @returns via cbk
  {
    payment_secret: <Payment Secret Hex String>
    transaction_id: <Transaction Id Hex String>
  }
*/
module.exports = (args, cbk) => {
  return asyncAuto({
    // Check the current state of the blockchain to get a good locktime
    getBlockchainInfo: cbk => getBlockchainInfo({network: args.network}, cbk),

    // Figure out what fee is needed to sweep the funds
    getFee: cbk => getChainFeeRate({network: args.network}, cbk),

    // Make a new address to sweep out the funds to
    getSweepAddress: cbk => createAddress({network: args.network}, cbk),

    // Check completion arguments
    validate: cbk => {
      if (!args.invoice) {
        return cbk([400, 'ExpectedInvoice']);
      }

      if (!args.network) {
        return cbk([400, 'ExpectedNetwork']);
      }

      if (!args.private_key) {
        return cbk([400, 'ExpectedPrivateKey']);
      }

      if (!args.redeem_script) {
        return cbk([400, 'ExpectedRedeemScript']);
      }

      if (!args.transaction) {
        return cbk([400, 'ExpectedFundingTransaction']);
      }

      return cbk();
    },

    // Funding UTXOs from the transaction
    fundingUtxos: ['validate', (_, cbk) => {
      try {
        return cbk(null, swapScriptInTransaction({
          redeem_script: args.redeem_script,
          transaction: args.transaction,
        }));
      } catch (e) {
        return cbk([0, e.message, e]);
      }
    }],

    // Pay the invoice
    payInvoice: [
      'fundingUtxos',
      'getBlockchainInfo',
      'getFee',
      'getSweepAddress',
      (_, cbk) =>
    {
      return payInvoice({invoice: args.invoice}, cbk);
    }],

    // Create a claim transaction to sweep the swap
    claimTransaction: ['payInvoice', (res, cbk) => {
      try {
        return cbk(null, claimTransaction({
          current_block_height: res.getBlockchainInfo.current_height,
          destination: res.getSweepAddress.chain_address,
          fee_tokens_per_vbyte: res.getFee.fee_tokens_per_vbyte,
          preimage: res.payInvoice.payment_secret,
          private_key: args.private_key,
          utxos: res.fundingUtxos.matching_outputs,
        }));
      } catch (e) {
        return cbk([500, 'ExpectedClaimTransaction', e]);
      }
    }],

    // Broadcast the claim transaction
    broadcastTransaction: ['claimTransaction', ({claimTransaction}, cbk) => {
      return broadcastTransaction({
        network: args.network,
        transaction: claimTransaction.transaction,
      },
      cbk);
    }],

    // Return the details of the completed swap
    completedSwap: ['broadcastTransaction', (res, cbk) => {
      return cbk(null, {
        payment_secret: res.payInvoice.payment_secret,
        transaction_id: res.broadcastTransaction.transaction_id,
      });
    }],
  },
  returnResult({of: 'completedSwap'}, cbk));
};

