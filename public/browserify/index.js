const {refundTransaction} = require('./../../swaps');
const {swapScriptDetails} = require('./../../swaps');

module.exports = {refundTransaction, swapScriptDetails};

window.blockchain = {refundTransaction, swapScriptDetails};

