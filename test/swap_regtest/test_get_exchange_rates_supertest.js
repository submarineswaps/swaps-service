const supertest = require('supertest');
const express = require('express');
const app = express();
const apiRouter = require('./../../routers/api');

app.use('/api/v0', apiRouter({console}));



supertest(app).get('/api/v0/exchange_rates/').expect(200).end(
  (err, res) => {
    console.log(err);
    console.log(res);
  }
);