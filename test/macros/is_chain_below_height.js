const {getBlockchainInfo} = require('./../../chain');

/** Determine if the chain is below a certain height

  {
    height: <Wait for Height Number>
    network: <Network to Check Name String>
  }
*/
module.exports = ({height, network}, cbk) => {
  return getBlockchainInfo({network}, (err, chain) => {
    if (!!err) {
      return cbk(err);
    }

    return cbk(null, chain.current_height < height)
  });
};

