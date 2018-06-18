const {addressDetails} = require('./../chain');

/** Derive address details

  {
    address: <Address String>
    network: <Network Name String>
  }

  @returns via cbk
  {
    [data]: <Witness Address Data Hex String>
    [hash]: <Address Hash Data Hex String>
    [prefix]: <Witness Prefix String>
    type: <Address Type String>
    version: <Address Version Number>
  }
*/
module.exports = ({address, network}, cbk) => {
  try {
    const details = addressDetails({address, network});

    return cbk(null, {
      type: details.type,
      data: details.data,
      hash: details.hash,
      prefix: details.prefix,
      version: details.version,
    });
  } catch (e) {
    return cbk([400, 'ExpectedValidAddress', e]);
  }
};

