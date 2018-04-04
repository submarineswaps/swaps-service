const {lightningDaemon} = require('ln-service');
const {payInvoice} = require('ln-service');

const {OCW_LND_GRPC_HOST} = process.env;
const {OCW_LND_MACAROON} = process.env;
const {OCW_LND_TLS_CERT} = process.env;

/** Pay Lightning Invoice

  {
    invoice: <BOLT 11 Invoice String>
  }

  @returns via cbk
  {
    payment_secret: <Payment Preimage Hex String>
  }
*/
module.exports = ({invoice}, cbk) => {
  if (!invoice) {
    return cbk([400, 'ExpectedInvoice']);
  }

  const lnd = lightningDaemon({
    cert: OCW_LND_TLS_CERT,
    host: OCW_LND_GRPC_HOST,
    macaroon: OCW_LND_MACAROON,
  });

  return payInvoice({invoice, lnd, wss: []}, (err, res) => {
    if (!!err) {
      return cbk([503, 'FailedToPayInvoice', err]);
    }

    return cbk(null, {payment_secret: res.payment_secret});
  });
};

