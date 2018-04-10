const {generateKeyPair} = require('./../../chain');
const {refundTransaction} = require('./../../swaps');
const {swapScriptDetails} = require('./../../swaps');

module.exports = {generateKeyPair, refundTransaction, swapScriptDetails};

window.blockchain = {generateKeyPair, refundTransaction, swapScriptDetails};

