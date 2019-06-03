const config = require('dotenv').config();

const {addSwapToPool} = require('./pool');
const apiRouter = require('./routers/api');
const {createScanners} = require('./scan');
const createServer = require('./create_server');
const {isConfigured} = require('./service');
const {networks} = require('./tokenslib');
const {swapScanner} = require('./scan');

const cache = 'redis';
const isProduction = process.env.NODE_ENV === 'production';
const {keys} = Object;
const {log} = console;
const logOnErr = err => !!err ? console.log(err) : null;
const port = process.env.PORT || process.env.SSS_PORT || 9889;
const scannersStartDelay = 1000 * 10;

setTimeout(() => {
  try {
    const scanners = createScanners({
      cache,
      found: ({swap}) => addSwapToPool({cache, swap}, logOnErr),
      log: logOnErr,
      networks: keys(networks).filter(network => isConfigured({network})),
    });
  } catch (err) {
    log(err);
  }
},
scannersStartDelay);

const app = createServer({});

app.use('/api/v0', apiRouter({cache, log}));

app.listen(port, () => log(`Server listening on port ${port}.`));
