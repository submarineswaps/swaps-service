const {decode} = require('bolt11');

const errCode = require('./../conf/error_codes');

/** Parse a Lightning invoice

  {
    invoice: <Bolt 11 Lightning Invoice String>
  }

  @returns via cbk
  {
    payment_hash: <Payment Hash Hex String>
  }
*/
module.exports = ({invoice}, cbk) => {
  if (!invoice) {
    return cbk([errCode.local_err, 'Expected invoice']);
  }

  try {
    const {tags} = decode(invoice);

    const [paymentHashTag] = tags.filter(t => t.tagName === 'payment_hash');

    return cbk(null, {payment_hash: paymentHashTag.data});
  } catch (e) {
    return cbk([errCode.local_err, 'Error parsing invoice', e]);
  }
};

