const {decodePsbt} = require('./../bip174');
const {ECPair} = require('./../tokenslib');
const {extractTransaction} = require('./../bip174');
const {finalizePsbt} = require('./../bip174');
const {networks} = require('./../tokenslib');
const {signPsbt} = require('./../bip174');
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
  const decoded = decodePsbt({psbt});
  const {publicKey} = ECPair.fromWIF(key, networks[network]);

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
      data_push: publicKey.toString('hex'),
      stack_index: 1,
      vin: 0,
    }],
    psbt: updatedPsbt.psbt,
    signing_keys: [key],
  });

  const finalizedPsbt = finalizePsbt({psbt: signedPsbt.psbt});

  return extractTransaction({psbt: finalizedPsbt.psbt});
};

