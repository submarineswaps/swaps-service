const {authenticatedLndGrpc} = require('ln-service');
const {subscribeToInvoices} = require('ln-service');

const daemons = {};

/** Get the Lightning Network Daemon connection.

  {
    network: <Network Name String>
  }

  @throws
  <Error> when daemon credentials are not available

  @returns
  <LND GRPC API Object>
*/
module.exports = ({network}) => {
  if (!network) {
    throw new Error('ExpectedNetworkForLightningDaemon');
  }

  if (daemons[network] && daemons[network].lnd) {
    return daemons[network].lnd;
  }

  let lnd;
  const networkName = network.toUpperCase();

  const cert = process.env[`SSS_LND_${networkName}_TLS_CERT`];
  const macaroon = process.env[`SSS_LND_${networkName}_MACAROON`];
  const socket = process.env[`SSS_LND_${networkName}_GRPC_HOST`];

  if (!cert) {
    throw new Error('ExpectedDaemonCert');
  }

  if (!macaroon) {
    throw new Error('ExpectedDaemonMacaroon');
  }

  if (!socket) {
    throw new Error('ExpectedDaemonHost');
  }

  try {
    lnd = authenticatedLndGrpc({cert, macaroon, socket}).lnd;
  } catch (err) {
    throw new Error('FailedToInstantiateDaemon');
  }

  const sub = subscribeToInvoices({lnd});

  daemons[network] = {lnd, sub};

  // Clear daemon cache on errors or end of subscription
  // This subscription allows opportunistic reconnecting on remote restarts.
  daemons[network].sub.on('invoice_updated', () => {});
  daemons[network].sub.on('end', () => daemons[network] = null);
  daemons[network].sub.on('error', () => daemons[network] = null);
  daemons[network].sub.on('status', () => {});

  return lnd;
};
