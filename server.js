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

const apiRouter = require('./routers/api');
const {swapScanner} = require('./scan');

const {NODE_ENV} = process.env;
const {SSS_PORT} = process.env;
const {PORT} = process.env;

const browserifyPath = `${__dirname}/public/browserify/index.js`;
const isProduction = NODE_ENV === 'production';
const morganLogLevel = 'dev';
const port = PORT || SSS_PORT || 9889;

const app = express();
const scanner = swapScanner({cache: 'memory', network: 'testnet'});

scanner.on('claim', swap => {
  console.log('SWAP CLAIMED', swap);

  return;
});
scanner.on('error', err => log);
scanner.on('funding', swap => {
  console.log("SWAP FUNDED", swap);

  return;
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
app.use('/api/v0', apiRouter({log}));
app.get('/refund', ({path}, res) => res.render('refund', {path}));

app.listen(port, () => log(`Server listening on port ${port}.`));

if (!isProduction) {
  walnut.check(require('./package'));
}

