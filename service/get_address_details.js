const {addressDetails} = require('./../chain');

/** Derive address details

  {
    address: <Address String>
  }

  @returns via cbk
  {
    [data]: <Witness Address Data Hex String>
    [hash]: <Address Hash Data Hex String>
    is_testnet: <Is Testnet Address Bool>
    [prefix]: <Witness Prefix String>
    type: <Address Type String>
    version: <Address Version Number>
  }
*/
module.exports = ({address}, cbk) => {
  try {
    const details = addressDetails({address});

    return cbk(null, {
      type: details.type,
      data: details.data,
      hash: details.hash,
      is_testnet: details.is_testnet,
      prefix: details.prefix,
      version: details.version,
    });
  } catch (e) {
    return cbk([400, 'ExpectedValidAddress', e]);
  }
};

