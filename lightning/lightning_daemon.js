const {lightningDaemon} = require('ln-service');

const {SSS_LND_GRPC_HOST_BTC} = process.env;
const {SSS_LND_MACAROON_BTC} = process.env;
const {SSS_LND_TLS_CERT_BTC} = process.env;

const {SSS_LND_GRPC_HOST_LTC} = process.env;
const {SSS_LND_MACAROON_LTC} = process.env;
const {SSS_LND_TLS_CERT_LTC} = process.env;

/** Get the Lightning Network Daemon connection

  {}

  @throws
  <Error> when daemon credentials are not available

  @returns
  <LND GRPC API Object>
*/
module.exports = ({network}) => {
  try {
    if (network === "testnet") {
      return lightningDaemon({
        cert: SSS_LND_TLS_CERT_BTC,
        host: SSS_LND_GRPC_HOST_BTC,
        macaroon: SSS_LND_MACAROON_BTC,}
      );
    } else if (network === "ltctestnet"){
      return lightningDaemon({
        cert: SSS_LND_TLS_CERT_LTC,
        host: SSS_LND_GRPC_HOST_LTC,
        macaroon: SSS_LND_MACAROON_LTC,}
      );
    }
  } catch (e) {
    throw new Error('FailedToInitializedLightningGrpcApi');
  }
};

