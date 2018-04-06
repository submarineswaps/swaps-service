const {log} = console;

const browserify = require('browserify-middleware');
const compression = require('compression');
const express = require('express');
const {hidePoweredBy} = require('helmet');
const morgan = require('morgan');
const walnut = require('walnut');

const apiRouter = require('./routers/api');

const {NODE_ENV} = process.env;
const {OCW_PORT} = process.env;
const {PORT} = process.env;

const browserifyPath = `${__dirname}/public/browserify/index.js`;
const isProduction = NODE_ENV === 'production';
const morganLogLevel = 'dev';
const port = PORT || OCW_PORT || 9889;

const app = express();

app.use(hidePoweredBy())
app.use(compression());

app.get('/js/blockchain.js', browserify(browserifyPath));

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

