const {lightningDaemon} = require('ln-service');

const {SSS_BTC_LND_GRPC_HOST} = process.env;
const {SSS_BTC_LND_MACAROON} = process.env;
const {SSS_BTC_LND_TLS_CERT} = process.env;

const {SSS_LTC_LND_GRPC_HOST} = process.env;
const {SSS_LTC_LND_MACAROON} = process.env;
const {SSS_LTC_LND_TLS_CERT} = process.env;

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
        cert: SSS_BTC_LND_TLS_CERT,
        host: SSS_BTC_LND_GRPC_HOST,
        macaroon: SSS_BTC_LND_MACAROON,}
      );
    } else if (network === "ltctestnet"){
      return lightningDaemon({
        cert: SSS_LTC_LND_TLS_CERT,
        host: SSS_LTC_LND_GRPC_HOST,
        macaroon: SSS_LTC_LND_MACAROON,}
      );
    }
  } catch (e) {
    throw new Error('FailedToInitializedLightningGrpcApi');
  }
};

