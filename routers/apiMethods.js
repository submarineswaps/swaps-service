const {returnJson} = require('./../async-util');
const apiConstants = require('./../chain/conf/api_constants.json');

const {createSwap} = require('./../service');
const {findSwapOutpoint} = require('./../service');
const {getAddressDetails} = require('./../service');
const {getExchangeRates} = require('./../service');
const {getInvoiceDetails} = require('./../service');
const {checkSwapStatus} = require('./../service');
const {broadcastTransaction} = require('./../service');



const reqGetAddressDetails = function (args) {
  return getAddressDetails({
      address: args.req.params.address,
      network: args.req.params.network
    }, returnJson({log: args.log, res: args.res})
  );
};

const reqGetExchangeRates = function (args) {
  args.cache = args.cache || apiConstants.cache;

  return getExchangeRates({
      cache: args.cache,
      networks: apiConstants.swapNetworks,
    }, (err, res) => {
      returnJson({log: args.log, res: args.res});
      if (args.cbk) {
        args.cbk(err, res);
      }
    }
  );
};

const reqGetInvoiceDetails = function (args) {
  args.cache = args.cache || apiConstants.cache;

  getInvoiceDetails({
      cache: args.cache,
      invoice: args.req.params.invoice,
      network: args.req.params.network,
    }, (err, res) => {
      returnJson({log, res});
      if (args.cbk) {
        args.cbk(err, res);
      }
    }
  );
};
const reqFindSwapOutpoint = function (args) {
  return findSwapOutpoint({
      network: args.req.body.network,
      redeem_script: args.req.body.redeem_script,
    },
    (err, res) => {
      returnJson({log: args.log, res: args.res});
      if (args.cbk) {
        args.cbk(err, res);
      }
    });
};
const reqCreateSwap = function (args) {
  args.cache = args.cache || apiConstants.cache;

  return createSwap({
      cache: args.cache,
      invoice: args.req.body.invoice,
      network: args.req.body.network,
      refund: args.req.params.body.refund,
    },
    (err, res) => {
      returnJson({log: args.log, res: args.res});
      if (args.cbk) {
        args.cbk(err, res);
      }
    });
};
const reqCheckSwapStatus = function ({args}) {
  args.cache = args.cache || apiConstants.cache;
  return checkSwapStatus({
      cache: args.cache,
      invoice: args.req.body.invoice,
      network: args.req.body.network,
      script: args.req.body.redeem_script,
    },
    (err, res) => {
      returnJson({log: args.log, res: args.res});
      if (args.cbk) {
        args.cbk(err, res);
      }
    });
};

const reqBroadcastTransaction = function ({args}) {
  return broadcastTransaction({
      network: args.req.body.network,
      transaction: args.req.body.transaction
    },
    (err, res) => {
      returnJson({log: args.log, res: args.res});
      if (args.cbk) {
        args.cbk(err, res);
      }
    }
  )
}

module.exports = {
  reqGetAddressDetails,
  reqGetExchangeRates,
  reqGetInvoiceDetails,
  reqFindSwapOutpoint,
  reqCreateSwap,
  reqCheckSwapStatus,
  reqBroadcastTransaction
};