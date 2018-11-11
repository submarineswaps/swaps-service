const {log} = console;

const asyncAuto = require('async/auto');
const {generateMnemonic} = require('bip39');
const {parsePaymentRequest} = require('ln-service');
const request = require('request');
const {test} = require('tap');

const apiRouter = require('./../../routers/api');
const createServer = require('./../../create_server');
const credentialsForNetwork = require('./../../chain/credentials_for_network');
const {generateInvoice} = require('./../macros');
const {generateKeyPair} = require('./../../chain');
const {spawnChainDaemon} = require('./../macros');
const {spawnLnd} = require('./../macros');
const {stopChainDaemon} = require('./../../chain');

const baseFee = 1;
const cache = 'memory';
const daemon = 'btcd';
const exitServerTimeoutMs = 1000;
const feeRate = 1;
const network = 'regtest';
const port = 8193;
const requiredConfs = 0;
const seed = generateMnemonic();
const successStatusCode = 200;

test('Can get invoice details from endpoint', ({assert, end, equal}) => {
  return asyncAuto({
    // Spin up a chain server
    spawnChainServer: cbk => {
      const key = generateKeyPair({network}).public_key;

      return spawnChainDaemon({daemon, network, mining_public_key: key}, cbk);
    },

    // Spin up an LND
    startLnd: cbk => spawnLnd({}, cbk),

    // Make an invoice to check
    createInvoice: ['startLnd', ({startLnd}, cbk) => {
      return generateInvoice({lnd: startLnd.lnd}, cbk);
    }],

    // Start up the web server
    startServer: ['startLnd', ({startLnd}, cbk) => {
      const app = createServer({is_logging_disabled: true});

      app.use('/api/v0', apiRouter({cache, log, lnd: startLnd.lnd}));

      return app.listen(port, cbk);
    }],

    // Request invoice details from the API server
    getInvoiceDetails: [
      'createInvoice',
      'spawnChainServer',
      'startLnd',
      'startServer',
      ({createInvoice, spawnChainServer, startLnd}, cbk) =>
    {
      const api = `http://localhost:${port}/api/v0/invoice_details`;
      const auth = credentialsForNetwork({network});

      const rpcApi = `${auth.user}:${auth.pass}@${auth.host}:${auth.port}`;
      const url = `${api}/${network}/${createInvoice.invoice}`;

      process.env.SSS_CHAIN_REGTEST_RPC_API = rpcApi;
      process.env.SSS_CLAIM_BIP39_SEED = seed;
      process.env.SSS_FEE_BASE_REGTEST_REGTEST = baseFee;
      process.env.SSS_FEE_RATE_REGTEST_REGTEST = feeRate;
      process.env.SSS_FUNDING_REGTEST_CONFS = requiredConfs;
      process.env.SSS_LND_REGTEST_TLS_CERT = startLnd.cert;
      process.env.SSS_LND_REGTEST_GRPC_HOST = startLnd.host;
      process.env.SSS_LND_REGTEST_MACAROON = startLnd.macaroon;

      return request({url, json: true}, (err, r, body) => {
        const code = r.statusCode;
        const msg = body;

        if (code !== 400) {
          return cbk([500, 'ExpectedFailureCodeForPaymentRequest']);
        }

        if (msg !== 'InsufficientCapacityForSwap') {
          return cbk([500, 'ExpectedUnspendableMessageForPaymentRequest']);
        }

        return cbk();
      });
    }],

    // Stop the LND process
    stopLnd: ['getInvoiceDetails', 'startLnd', ({startLnd}, cbk) => {
      return startLnd.kill({}, cbk);
    }],

    // Stop the chain daemon process
    stopChainDaemon: [
      'getInvoiceDetails',
      'spawnChainServer',
      ({spawnChainServer}, cbk) =>
    {
      return stopChainDaemon({network}, cbk);
    }],
  },
  (err, res) => {
    if (!!res.spawnChainServer) {
      res.spawnChainServer.daemon.kill();
    }

    if (!!res.startLnd) {
      res.startLnd.kill({}, () => {});
    }

    setTimeout(() => process.exit(), exitServerTimeoutMs);

    if (!!err) {
      throw new Error(err);

      return end();
    }

    return end();
  });
});

