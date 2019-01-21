const {parsePaymentRequest} = require('ln-service');

/** Parse a payment request

  {
    request: <BOLT 11 Payment Request String>
  }

  @throws
  <UnexpectedNetworkForRequest Error>
  <ExpectedValidRequestToParse Error>

  @returns
  {
    created_at: <Invoice Creation Date ISO 8601 String>
    [description]: <Description String>
    destination: <Public Key String>
    expires_at: <ISO 8601 Date String>
    id: <Payment Request Hash String>
    is_expired: <Invoice is Expired Bool>
    network: <Network Name String>
    routes: <Routes Object>
    [tokens]: <Requested Chain Tokens Number>
  }
*/
module.exports = ({request}) => {
  let details;
  let network;

  try {
    details = parsePaymentRequest({request});
  } catch (err) {
    throw new Error('ExpectedValidRequestToParse');
  }

  switch (details.network) {
  case 'bitcoin':
  case 'regtest':
  case 'testnet':
    network = details.network;
    break;

  case 'litecoin':
    network = 'ltc';
    break;

  default:
    throw new Error('UnexpectedNetworkForRequest');
  }

  return {
    network,
    created_at: details.created_at,
    description: details.description,
    destination: details.destination,
    expires_at: details.expires_at,
    id: details.id,
    is_expired: details.is_expired,
    routes: details.routes,
    tokens: details.tokens,
  };
};

