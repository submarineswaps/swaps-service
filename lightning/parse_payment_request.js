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
    [features]: [{
      bit: <Feature Bit Number>
    }]
    id: <Payment Request Hash String>
    is_expired: <Invoice is Expired Bool>
    [mtokens]: <Requested Millitokens String>
    network: <Network Name String>
    payment: <Payment Identifier Hex String>
    routes: <Routes Object>
    timeout: <CLTV Final Delta Number>
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
    features: details.features,
    id: details.id,
    is_expired: details.is_expired,
    mtokens: details.mtokens,
    payment: details.payment,
    routes: details.routes,
    timeout: details.cltv_delta,
    tokens: details.tokens,
  };
};
