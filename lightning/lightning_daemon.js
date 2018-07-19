const {lightningDaemon} = require('ln-service');

const {SSS_TESTNET_GRPC_HOST} = process.env;
const {SSS_TESTNET_MACAROON} = process.env;
const {SSS_TESTNET_TLS_CERT} = process.env;


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
      cert: SSS_TESTNET_TLS_CERT,
      host: SSS_TESTNET_GRPC_HOST,
      macaroon: SSS_TESTNET_MACAROON,
    });
  default:
    throw new Error('FailedToInitializedLightningGrpcApi');
  }
};

