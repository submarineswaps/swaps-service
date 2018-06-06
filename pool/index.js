const addDetectedSwap = require('./add_detected_swap');
const getDetectedSwaps = require('./get_detected_swaps');

/** The swap pool contains a pool of recognized swaps for an invoice.

  Swaps are either outputs that fund a swap or inputs that spend a funded swap
  in a claim transaction or a refund transaction.
*/
module.exports = {addDetectedSwap, getDetectedSwaps};

