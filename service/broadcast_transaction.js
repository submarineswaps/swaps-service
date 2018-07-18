const {broadcastTransaction} = require('./../chain');

/** Send a raw transaction to the network

  {
    network: <Network Name String>
    transaction: <Transaction Hex String>
  }

  @returns via cbk
  {
    id: <Transaction Id Hex String>
  }
*/
module.exports = ({network, transaction}, cbk) => {
  return broadcastTransaction({network, transaction}, cbk);
};

