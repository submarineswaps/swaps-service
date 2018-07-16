const {spawn} = require('child_process');


/** Spawn an redis server for testing on regtest




 @returns via cbk
 {
 }
 */
module.exports = (args, cbk) => {
  const redisServer = spawn('redis-server', [
    '--port', '6380',
  ]);
  process.on('uncaughtException', err => {
    console.log('REDIS ERROR', err);
    redisServer.kill();
    process.exit(1);
  });
};