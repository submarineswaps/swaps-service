const {parseInvoice} = require('ln-service');

/** Parse an invoice

  {
    invoice: <BOLT 11 Invoice String>
  }

  @throws
  <Parse Invoice Error>

  @returns
  {
    network: <Network Name String>
  }
*/
module.exports = ({invoice}) => {
  const details = parseInvoice({invoice});

  switch (details.network) {
  case 'bitcoin':
  case 'regtest':
  case 'testnet':
    break;

  case 'litecoin':
    details.network = 'ltc';
    break;

  default:
    throw new Error('UnexpectedNetworkForInvoice');
  }

  return details;
};

