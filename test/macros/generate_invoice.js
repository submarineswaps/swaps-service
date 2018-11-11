const {createInvoice} = require('ln-service');

/** Generate an invoice payment preimage and payment hash pair

  {
    lnd: <LND GRPC API Object>
  }

  @returns via cbk
  {
    invoice: <Lightning Invoice String>
    payment_hash: <Payment Hash Hex String>
    payment_preimage: <Payment Preimage Hex String>
  }
*/
module.exports = ({lnd}, cbk) => {
  if (!lnd) {
    return cbk([400, 'ExpectedLndForInvoiceGeneration']);
  }

  return createInvoice({lnd, tokens: 1}, (err, res) => {
    if (!!err) {
      return cbk(err);
    }

    return cbk(null, {
      invoice: res.request,
      payment_hash: res.id,
      payment_preimage: res.secret,
    });
  });
};

