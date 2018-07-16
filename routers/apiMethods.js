const {returnJson} = require('./../async-util');
const apiConstants = require('./../chain/conf/api_constants.json');

const {createSwap} = require('./../service');
const {findSwapOutpoint} = require('./../service');
const {getAddressDetails} = require('./../service');
const {getExchangeRates} = require('./../service');
const {getInvoiceDetails} = require('./../service');

const reqGetAddressDetails = function (request, response, log) {
  console.log("getAddressDetails");
  console.log("Request:");
  console.log(request);
  console.log("\nResponse:");
  console.log(response);
  console.log("\nLog:");
  console.log(log);
  console.log("\n"*2);
  const {params} = request;
  return getAddressDetails({address: params.address, network: params.network}, returnJson({log, response}));
};

const reqGetExchangeRates = function (request, response, log) {
  console.log("reqGetExchangeRates");
  console.log("Request:");
  console.log(request);
  console.log("\nResponse:");
  console.log(response);
  console.log("\nLog:");
  console.log(log);
  console.log("\n"*2);
  return getExchangeRates({
      cache: apiConstants.cache,
      networks: apiConstants.swapNetworks,
    },
    returnJson({log, response}));
};
const reqGetInvoiceDetails = function (request, response, log) {
  console.log("reqGetInvoiceDetails");
  console.log("Request:");
  console.log(request);
  console.log("\nResponse:");
  console.log(response);
  console.log("\nLog:");
  console.log(log);
  console.log("\n"*2);
  const {params} = request;
  return getInvoiceDetails({
      cache: apiConstants.cache,
      invoice: params.invoice,
      network: params.network,
    },
    returnJson({log, response}));
};
const reqFindSwapOutpoint = function (request, response, log) {
  console.log("reqFindSwapOutpoint");
  console.log("Request:");
  console.log(request);
  console.log("\nResponse:");
  console.log(response);
  console.log("\nLog:");
  console.log(log);
  console.log("\n"*2);
  const {params} = request;
  return findSwapOutpoint({
      network: params.body.network,
      redeem_script: params.body.redeem_script,
    },
    returnJson({log, response}));
};
const reqCreateSwap = function (request, response, log) {
  console.log("reqCreateSwap");
  console.log("Request:");
  console.log(request);
  console.log("\nResponse:");
  console.log(response);
  console.log("\nLog:");
  console.log(log);
  console.log("\n"*2);
  const {params} = request;

  router.post('/swaps/', ({body}, res) => {
    return createSwap({
        cache: apiConstants.cache,
        invoice: params.body.invoice,
        network: params.body.network,
        refund: params.body.refund,
      },
      returnJson({log, res}));
  });
};
const reqCheckSwapStatus = function (request, response, log) {
  console.log("reqCheckSwapStatus");
  console.log("Request:");
  console.log(request);
  console.log("\nResponse:");
  console.log(response);
  console.log("\nLog:");
  console.log(log);
  console.log("\n"*2);

};

module.exports = {
  reqGetAddressDetails,
  reqGetExchangeRates,
  reqGetInvoiceDetails,
  reqFindSwapOutpoint,
  reqCreateSwap,
  reqCheckSwapStatus
};