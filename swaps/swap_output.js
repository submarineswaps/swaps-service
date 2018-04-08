const {Transaction} = require('bitcoinjs-lib');

const notFoundIndex = -1;

/** Find the swap output in a raw transaction

  {
    p2sh_output_script: <Legacy P2SH Output Script Hex String>
    p2sh_p2wsh_output_script: <P2SH Nested Output Script Hex String>
    transaction: <Raw Transaction Hex String>
    witness_output_script: <Witness Output Script Hex String>
  }

  @throws
  <Error> on arguments or find failure

  @returns
  {
    output_index: <Swap UTXO Output Index Number>
    output_tokens: <Swap UTXO Output Tokens Number>
    transaction_id: <Swap UTXO Funding Transaction Id Hex String>
  }
*/
module.exports = args => {
  if (!args.transaction) {
    throw new Error('ExpectedRawTransaction');
  }

  const outputScripts = [
    args.p2sh_output_script,
    args.p2sh_p2wsh_output_script,
    args.witness_output_script,
  ];

  let transaction;

  const scriptPubs = outputScripts.filter(n => !!n)

  try {
    transaction = Transaction.fromHex(args.transaction);
  } catch (e) {
    throw new Error('ExpectedValidTransactionHex');
  }

  const outputIndex = transaction.outs.map(n => n.script.toString('hex'))
    .findIndex(script => scriptPubs.find(n => script === n));

  if (outputIndex === notFoundIndex) {
    throw new Error('ExpectedUtxoInTransaction');
  }

  const output = transaction.outs[outputIndex];

  if (!output.value) {
    throw new Error('ExpectedOutputValue');
  }

  return {
    output_index: outputIndex,
    output_tokens: output.value,
    transaction_id: transaction.getId(),
  };
};

