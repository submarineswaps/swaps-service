const {decode} = require('bolt11');

/** Parse a Lightning invoice

  {
    invoice: <Bolt 11 Lightning Invoice String>
  }

  @returns via cbk
  {
    id: <Payment Hash Hex String>
  }
*/
module.exports = ({invoice}, cbk) => {
  if (!invoice) {
    return cbk([0, 'Expected invoice']);
  }

  try {
    const {tags} = decode(invoice);

    const [paymentHashTag] = tags.filter(t => t.tagName === 'payment_hash');

    return cbk(null, {id: paymentHashTag.data});
  } catch (e) {
    return cbk([0, 'Error parsing invoice', e]);
  }
};

