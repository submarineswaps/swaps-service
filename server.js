const {log} = console;

const {join} = require('path');

const browserify = require('browserify-middleware');
const compression = require('compression');
const cors = require('cors');
const express = require('express');
const {hidePoweredBy} = require('helmet');
const morgan = require('morgan');
const serveFavicon = require('serve-favicon');
const walnut = require('walnut');

require('dotenv').config();

const {addSwapToPool} = require('./pool');
const apiRouter = require('./routers/api');
const {isConfigured} = require('./service');
const {confirmChainBackend} = require('./blocks');
const {networks} = require('./tokenslib');
const {swapScanner} = require('./scan');

const {NODE_ENV} = process.env;
const {SSS_PORT} = process.env;
const {PORT} = process.env;
const {CACHE} = process.env;

const browserifyPath = `${__dirname}/public/browserify/index.js`;
const cache = CACHE || 'redis';
const isProduction = NODE_ENV === 'production';
const morganLogLevel = 'dev';
const port = PORT || SSS_PORT || 9889;

const app = express();
const logOnErr = err => !!err ? log(err) : null;

const scanners = Object.keys(networks).map(network => {
  if (!isConfigured({network})) {
    return null;
  }

  const scanner = swapScanner({cache, network});

  scanner.on('claim', swap => addSwapToPool({cache, swap}, logOnErr));
  scanner.on('error', err => logOnErr);
  scanner.on('funding', swap => addSwapToPool({cache, swap}, logOnErr));
  scanner.on('refund', swap => addSwapToPool({cache, swap}, logOnErr));

  confirmChainBackend({network}, logOnErr);

  return scanner;
});

app.use(hidePoweredBy())
app.use(compression());
app.use(cors());
app.get('/js/blockchain.js', browserify(browserifyPath));
app.use(serveFavicon(join(__dirname, 'public', 'favicon.ico')));
app.use(express.static('public'));
app.use(morgan(morganLogLevel));
app.set('view engine', 'pug')
app.get('/', ({path}, res) => res.render('index', {path}));
app.use('/api/v0', apiRouter({log, cache}));
app.get('/refund', ({path}, res) => res.render('refund', {path}));

app.listen(port, () => log(`Server listening on port ${port}.`));

if (!isProduction) {
  walnut.check(require('./package'));
}

