const {createClient} = require('redis');

let client;
const {REDIS_URL} = process.env;

/** Get the redis cache

  {}

  @throws
  <Error> when the REDIS_URL isn't set
*/
module.exports = ({}) => {
  if (!REDIS_URL) {
    throw new Error('ExpectedRedisUrl');
  }

  client = client || createClient(REDIS_URL);

  // Listen for errors
  client.on('error', err => {});

  return client;
};

