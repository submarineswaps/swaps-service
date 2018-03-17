const {log} = console;

const express = require('express');
const morgan = require('morgan');
const walnut = require('walnut');

const apiRouter = require('./routers/api');

const isProduction = process.env.NODE_ENV === 'production';
const port = process.env.PORT || process.env.ORION_DEMO_PORT || 9889;

const app = express();

app.use(express.static('public'));
app.use(morgan('dev'));
app.set('view engine', 'pug')

app.get('/', (req, res) => res.render('index'));
app.use('/api/v0', apiRouter({log}));

app.listen(port, () => log(`Server listening on port ${port}.`));

if (!isProduction) {
  walnut.check(require('./package'));
}

