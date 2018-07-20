const broadcastTransaction = require('./broadcast_transaction');
const checkSwapStatus = require('./check_swap_status');
const createSwap = require('./create_swap');
const findSwapOutpoint = require('./find_swap_outpoint');
const findSwapTransaction = require('./find_swap_transaction');
const getActiveNetworks = require('./get_active_networks');
const getAddressDetails = require('./get_address_details');
const getExchangeRates = require('./get_exchange_rates');
const getInvoiceDetails = require('./get_invoice_details');
const getSwapStatus = require('./get_swap_status');
const isConfigured = require('./is_configured');

/** Service methods for providing results to swap API calls
*/
module.exports = {
  broadcastTransaction,
  checkSwapStatus,
  createSwap,
  findSwapOutpoint,
  findSwapTransaction,
  getActiveNetworks,
  getAddressDetails,
  getExchangeRates,
  getInvoiceDetails,
  isConfigured,
};

