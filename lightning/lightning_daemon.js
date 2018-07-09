const {lightningDaemon} = require('ln-service');

const {SSS_LND_GRPC_HOST} = process.env;
const {SSS_LND_MACAROON} = process.env;
const {SSS_LND_TLS_CERT} = process.env;

/** Get the Lightning Network Daemon connection

  {}

  @throws
  <Error> when daemon credentials are not available

  @returns
  <LND GRPC API Object>
*/
module.exports = ({}) => {
  try {
    return lightningDaemon({
      cert: SSS_LND_TLS_CERT,
      host: SSS_LND_GRPC_HOST,
      macaroon: SSS_LND_MACAROON,
    });
  } catch (e) {
    throw new Error('FailedToInitializedLightningGrpcApi');
  }
};

