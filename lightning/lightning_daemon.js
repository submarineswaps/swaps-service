const {lightningDaemon} = require('ln-service');

const {OCW_LND_GRPC_HOST} = process.env;
const {OCW_LND_MACAROON} = process.env;
const {OCW_LND_TLS_CERT} = process.env;

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
      cert: OCW_LND_TLS_CERT,
      host: OCW_LND_GRPC_HOST,
      macaroon: OCW_LND_MACAROON,
    });
  } catch (e) {
    throw new Error('FailedToInitializedLightningGrpcApi');
  }
};

