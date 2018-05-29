const {Transaction} = require('bitcoinjs-lib');

const isPublicKeyHashSpend = require('./is_pkhash_spend');
const isSwapSpend = require('./is_swap_spend');
const scriptElements = require('./script_elements');

const preimageByteLength = 32;

/** Given a raw transaction, return the inputs that appear to be resolutions of
  swaps.

  {
    transaction: <Transaction Hex String>
  }

  @throws
  <Error> when transaction is invalid

  @returns
  {
    resolutions: [{
      script: <Redeem Script Hex String>
      type: <Type String> 'claim|refund'
    }]
  }
*/
module.exports = ({transaction}) => {
  let inputs;

  try {
    // Decode the raw transaction
    inputs = Transaction.fromHex(transaction).ins;
  } catch (e) {
    throw e;
  }

  // Find inputs that appear to be swap spends.
  const resolutions = inputs
    .filter(({script, witness}) => !isPublicKeyHashSpend({script, witness}))
    .filter(({script, witness}) => isSwapSpend({script, witness}))
    .map(({script, witness}) => {
      const [redeemScript, preimage, sig] = scriptElements({script, witness});

      return {
        script: redeemScript.toString('hex'),
        type: preimage.length === preimageByteLength ? 'claim' : 'refund',
      };
    });

  return {resolutions};
};

