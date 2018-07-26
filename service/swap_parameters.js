const decBase = 10;
const {SSS_FUNDING_BCH_CONFS} = process.env;
const {SSS_FUNDING_BCHTESTNET_CONFS} = process.env;
const {SSS_FUNDING_BITCOIN_CONFS} = process.env;
const {SSS_FUNDING_LTC_CONFS} = process.env;
const {SSS_FUNDING_LTCTESTNET_CONFS} = process.env;
const {SSS_FUNDING_TESTNET_CONFS} = process.env;

const params = {
  bch: {
    claim_window: 3,
    funding_confs: parseInt(SSS_FUNDING_BCH_CONFS || 1, decBase),
    refund_timeout: 144,
    swap_fees: [{base: 10000, network: 'bitcoin', rate: 10000}],
  },
  bchtestnet: {
    claim_window: 10,
    funding_confs: parseInt(SSS_FUNDING_BCHTESTNET_CONFS || 3, decBase),
    refund_timeout: 144,
    swap_fees: [{base: 10000, network: 'testnet', rate: 10000}],
  },
  bitcoin: {
    claim_window: 14,
    funding_confs: parseInt(SSS_FUNDING_BITCOIN_CONFS || 3, decBase),
    refund_timeout: 144,
    swap_fees: [{base: 1000, network: 'bitcoin', rate: 1000}],
  },
  ltc: {
    claim_window: 3,
    funding_confs: parseInt(SSS_FUNDING_LTC_CONFS || 3, decBase),
    refund_timeout: 576,
    swap_fees: [{base: 30000, network: 'bitcoin', rate: 14900}],
  },
  ltctestnet: {
    claim_window: 10,
    funding_confs: parseInt(SSS_FUNDING_LTCTESTNET_CONFS || 12, decBase),
    refund_timeout: 576,
    swap_fees: [{base: 30000, network: 'testnet', rate: 14900}],
  },
  testnet: {
    claim_window: 10,
    funding_confs: parseInt(SSS_FUNDING_TESTNET_CONFS || 3, decBase),
    refund_timeout: 144,
    swap_fees: [{base: 1000, network: 'testnet', rate: 1000}],
  },
};

/** Get swap parameters for a network

  {
    network: <Network Name String>
  }

  @throws Error

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
  if (!params[network]) {
    throw new Error('UnknownNetworkForSwapParams');
  }

  return params[network];
};

