const {decodePsbt} = require('./../bip174');
const {ECPair} = require('./../tokenslib');
const {extractTransaction} = require('./../bip174');
const {finalizePsbt} = require('./../bip174');
const {networks} = require('./../tokenslib');
const {OP_0} = require('bitcoin-ops');
const {signPsbt} = require('./../bip174');
const swapScriptDetails = require('./swap_script_details');
const {Transaction} = require('./../tokenslib');
const {updatePsbt} = require('./../bip174');

const {SIGHASH_ALL} = Transaction;

/** Sign and finalize a refund psbt

  {
    key: <WIF Encoded Signing Key String>
    network: <Network Name String>
    psbt: <Unsigned Refund PSBT>
  }

  @throws
  <Sign Refund PSBT Error>

  @returns
  {
    transaction: <Refund Transaction Hex String>
  }
*/
module.exports = ({key, network, psbt}) => {
  if (typeof key !== 'string') {
    throw new Error('ExpectedWifRefundKey');
  }

  if (!network) {
    throw new Error('ExpectedNetworkForSignedRefundPsbt');
  }

  if (!psbt) {
    throw new Error('ExpectedUnsignedRefundsPsbt');
  }

  const decoded = decodePsbt({psbt});
  const {publicKey} = ECPair.fromWIF(key, networks[network]);

  const [input] = decoded.inputs;

  const {type} = swapScriptDetails({
    network,
    script: input.witness_script || input.redeem_script,
  });

  const tx = Transaction.fromHex(decoded.unsigned_transaction);

  const sighashes = tx.ins.map(({hash, index}) => {
    return {
      id: hash.reverse().toString('hex'),
      sighash: SIGHASH_ALL,
      vout: index,
    };
  });

  const updatedPsbt = updatePsbt({psbt, sighashes});

  const signedPsbt = signPsbt({
    network,
    additional_stack_elements: [{
      data_push: type === 'pkhash' ? publicKey.toString('hex') : undefined,
      op_code: type === 'pk' ? OP_0 : undefined,
      stack_index: 1,
      vin: 0,
    }],
    psbt: updatedPsbt.psbt,
    signing_keys: [key],
  });

  const finalizedPsbt = finalizePsbt({psbt: signedPsbt.psbt});

  return extractTransaction({psbt: finalizedPsbt.psbt});
};

