const asyncAuto = require('async/auto');
const asyncWhilst = require('async/whilst');
const {getInvoices} = require('ln-service');
const {returnResult} = require('asyncjs-util');

/** Get invoices

  {
    after: <After ISO 8601 Date String>
    lnd: <Authenticated LND gRPC API Object>
  }

  @returns via cbk
  {
    invoices: [{
      chain_address: <Fallback Chain Address String>
      [confirmed_at]: <Settled at ISO 8601 Date String>
      created_at: <ISO 8601 Date String>
      description: <Description String>
      description_hash: <Description Hash Hex String>
      expires_at: <ISO 8601 Date String>
      id: <Payment Hash String>
      [is_canceled]: <Invoice is Canceled Bool>
      is_confirmed: <Invoice is Confirmed Bool>
      [is_held]: <HTLC is Held Bool>
      is_outgoing: <Invoice is Outgoing Bool>
      is_private: <Invoice is Private Bool>
      received: <Received Tokens Number>
      received_mtokens: <Received Millitokens String>
      request: <Bolt 11 Invoice String>
      routes: [[{
        base_fee_mtokens: <Base Routing Fee In Millitokens Number>
        channel: <Standard Format Channel Id String>
        cltv_delta: <CLTV Blocks Delta Number>
        fee_rate: <Fee Rate In Millitokens Per Million Number>
        public_key: <Public Key Hex String>
      }]]
      secret: <Secret Preimage Hex String>
      tokens: <Tokens Number>
    }]
  }
*/
module.exports = ({after, lnd}, cbk) => {
  return new Promise((resolve, reject) => {
    return asyncAuto({
      // Check arguments
      validate: cbk => {
        if (!after) {
          return cbk([400, 'ExpectedAfterDateToGetInvoices']);
        }

        if (!lnd) {
          return cbk([400, 'ExpectedLndToGetInvoices']);
        }

        return cbk();
      },

      // Get invoices
      getInvoices: ['validate', ({}, cbk) => {
        const invoices = [];
        let limit = 25;
        let token = null;

        return asyncWhilst(
          cbk => cbk(null, token !== false),
          cbk => {
            return getInvoices({limit, lnd, token}, (err, res) => {
              if (!!err) {
                return cbk(err);
              }

              res.invoices
                .filter(invoice => invoice.created_at > after)
                .forEach(invoice => invoices.push(invoice));

              const oldInvoice = res.invoices.find(n => n.created_at < after);

              limit = null;
              token = !!oldInvoice || !res.next ? false : res.next;

              return cbk();
            });
          },
          err => {
            if (!!err) {
              return cbk(err);
            }

            return cbk(null, {invoices});
          }
        );
      }],
    },
    returnResult({reject, resolve, of: 'getInvoices'}, cbk));
  });
};
