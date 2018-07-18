const httpMocks = require('node-mocks-http');

/** Wraps a mocked http request-response flow

 {
   method: <HTTP method string>
   url: <Route url String>
   params: <Request parameters Object>
 }

 @returns

   Response object
 */
module.exports = (args, cbk) => {
  let req = httpMocks.createRequest(args);
  let res = httpMocks.createResponse();
  args.method({req, res, log: console, cache: 'memory', cbk});

};

