const {lightningDaemon} = require('ln-service');

const {SSS_TESTNET_LND_GRPC_HOST} = process.env;
const {SSS_TESTNET_LND_MACAROON} = process.env;
const {SSS_TESTNET_LND_TLS_CERT} = process.env;

const {SSS_LTCTESTNET_LND_GRPC_HOST} = process.env;
const {SSS_LTCTESTNET_LND_MACAROON} = process.env;
const {SSS_LTCTESTNET_LND_TLS_CERT} = process.env;

/** Get the Lightning Network Daemon connection

  {}

  @throws
  <Error> when daemon credentials are not available

  @returns
  <LND GRPC API Object>
*/
module.exports = ({network}) => {
  switch (network) {
  case 'testnet':
    return lightningDaemon({
      cert: SSS_TESTNET_LND_TLS_CERT,
      host: SSS_TESTNET_LND_GRPC_HOST,
      macaroon: SSS_TESTNET_LND_MACAROON,
    });
    break;
  case 'ltctestnet':
    return lightningDaemon({
      cert: SSS_LTCTESTNET_LND_TLS_CERT,
      host: SSS_LTCTESTNET_LND_GRPC_HOST,
      macaroon: SSS_LTCTESTNET_LND_MACAROON,
    });
    break;
  default:
    throw new Error('FailedToInitializedLightningGrpcApi');
  }
};

