/** Determine if a network is currently configured for swap service

  {
    network: <Network Name String>
  }

  @returns
  <Is Configured Bool>
*/
module.exports = ({network}) => {
  return !!process.env[`SSS_CHAIN_${network.toUpperCase()}_RPC_API`];
};

