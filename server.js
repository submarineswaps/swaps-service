const {log} = console;

const walnut = require('walnut');

require('dotenv').config();

const {addSwapToPool} = require('./pool');
const apiRouter = require('./routers/api');
const {createScanners} = require('./scan');
const createServer = require('./create_server');
const {isConfigured} = require('./service');
const {networks} = require('./tokenslib');
const {swapScanner} = require('./scan');

const {NODE_ENV} = process.env;
const {SSS_PORT} = process.env;
const {PORT} = process.env;

const cache = 'redis';
const isProduction = NODE_ENV === 'production';
const logOnErr = err => !!err ? log(err) : null;
const port = PORT || SSS_PORT || 9889;
const scannersStartDelay = 1000 * 10;

setTimeout(() => {
  try {
    const scanners = createScanners({
      cache,
      found: ({swap}) => addSwapToPool({cache, swap}, logOnErr),
      log: logOnErr,
      networks: Object.keys(networks).filter(network => isConfigured({network})),
    });
  } catch (err) {
    log(err);
  }
},
scannersStartDelay);

const app = createServer({});

app.use('/api/v0', apiRouter({cache, log}));

app.listen(port, () => log(`Server listening on port ${port}.`));

if (!isProduction) {
  walnut.check(require('./package'));
}

