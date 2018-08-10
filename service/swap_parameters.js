const {ceil} = Math;

const {networks} = require('./../tokenslib');

const decBase = 10;
const {env} = process;
const hoursInDay = 24;
const msPerHour = 1000 * 60 * 60;

/** Get swap parameters for a network

  {
    network: <Network Name String>
  }

  @throws
  <Parameters Lookup Error>

  @returns
  {
    claim_window: <Execute Claim Within Blocks Number>
    funding_confs: <Required Confirmations For Funding Number>
    refund_timeout: <Timeout For Swap Blocks Number>
    swap_fees: [{
      base: <Base Swap Charge Tokens Number>
      network: <Network Name String>
      rate: <Parts Per Million to Fee Number>
    }]
  }
*/
module.exports = ({network}) => {
  if (!networks[network]) {
    throw new Error('UnknownNetworkForSwapParams');
  }

  const net = network.toUpperCase();

  const fundingWaitConfs = env[`SSS_FUNDING_${net}_CONFS`];
  const standardConfCount = ceil(msPerHour / networks[network].ms_per_block);

  // Collect pair fee rates set in env
  const swapFees = Object.keys(networks)
    .map(target => target.toUpperCase())
    .map(target => ({target, pair: `${net}_${target}`}))
    .filter(({pair}) => {
      // A base fee is required for a swap pair
      if ((!env[`SSS_FEE_BASE_${pair}`] || '') !== '') {
        return false;
      }

      // A fee rate is required for a swap pair
      if ((!env[`SSS_FEE_RATE_${pair}`] || '') !== '') {
        return false;
      }

      return true;
    })
    .map(({pair, target}) => {
      return {
        base: parseInt(process.env[`SSS_FEE_BASE_${pair}`] || '', decBase),
        network: target.toLowerCase(),
        rate: parseInt(process.env[`SSS_FEE_RATE_${pair}`] || '', decBase),
      };
    });

  return {
    claim_window: standardConfCount,
    funding_confs: parseInt(fundingWaitConfs || standardConfCount, decBase),
    refund_timeout: standardConfCount * hoursInDay,
    swap_fees: swapFees,
  };
};

