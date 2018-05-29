/** Scan represents the internal server state that watches for in-progress
  swaps. Scanning allows for notifications regarding the progress of funding,
  claiming, and refunding swaps. Scanning can also help trigger a swap claim
  flow by alerting the server to the presence of a funded swap.
*/

const forgetSwap = require('./forget_swap');
const swapScanner = require('./swap_scanner');
const watchSwapOutput = require('./watch_swap_output');

module.exports = {forgetSwap, swapScanner, watchSwapOutput};

