const {join} = require('path');

const browserify = require('browserify-middleware');
const compression = require('compression');
const cors = require('cors');
const express = require('express');
const {hidePoweredBy} = require('helmet');
const morgan = require('morgan');
const serveFavicon = require('serve-favicon');

const browserifyPath = `${__dirname}/public/browserify/index.js`;
const morganLogLevel = 'dev';

/** Make a server

  {
    [is_logging_disabled]: <Should Avoid Logging Requests Bool>
  }

  @returns
  <Server Object>
*/
module.exports = args => {
  const app = express();

  app.use(hidePoweredBy());
  app.use(compression());
  app.use(cors());
  app.get('/js/blockchain.js', browserify(browserifyPath));
  app.use(serveFavicon(join(__dirname, 'public', 'favicon.ico')));
  app.use(express.static('public'));

  if (!args.is_logging_disabled) {
    app.use(morgan(morganLogLevel));
  }

  app.set('view engine', 'pug')
  app.get('/', ({path}, res) => res.render('index', {path}));
  app.get('/refund', ({path}, res) => res.render('refund', {path}));

  return app;
};

