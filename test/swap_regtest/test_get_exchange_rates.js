const supertest = require('supertest');
const {test} = require('tap');
const express = require('express');


const apiRouter = require('./../../routers/api');
cache = 'memory';

const app = express();
app.use('/api/v0', apiRouter({log: console.log, cache}));


test(`test exchange rates`, t => {
  supertest(app).get('/api/v0/exchange_rates/').query({networkOverrides: ['bchtestnet', 'ltctestnet', 'testnet']}).expect(200).end(
    (err, res) => {
      if (JSON.stringify(res.text).rates) {
        t.fail("InvalidGetExchangeRatesResponse")
      }
      t.end();
    }
  );
});


