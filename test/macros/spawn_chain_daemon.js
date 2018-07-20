const removeDir = require('rimraf');
const uuidv4 = require('uuid/v4');

const bcoinTypeDaemon = require('./bcoin_type_daemon');
const bitcoincoreTypeDaemon = require('./bitcoincore_type_daemon')
const btcsuiteTypeDaemon = require('./btcsuite_type_daemon');
/** Spawn a chain daemon for testing on regtest

  This method will also listen for uncaught exceptions and stop the daemon
  before the process dies.

  {
    daemon: <Daemon Type String>
    mining_public_key: <Mining Public Key Hex String>
    network: <Network Name String>
  }

  @returns via cbk
  {
    is_ready: <Chain Daemon is Ready Bool>
  }
 */
module.exports = (args, cbk) => {
  if (!args.daemon) {
    return cbk([400, 'ExpectedDaemonTypeToSpawn']);
  }

  if (!args.network) {
    return cbk([400, 'ExpectedNetworkTypeForChainDaemon']);
  }

  let daemon;
  const dir = !args.dir ? `/tmp/${uuidv4()}` : args.dir;

  switch (args.daemon) {
  case 'bcash':
  case 'bcoin':
    daemon = bcoinTypeDaemon({dir, network: args.network}, cbk);
    break;
  case 'btcd':
  case 'ltcd':
    daemon = btcsuiteTypeDaemon({
        daemon: args.daemon,
        dir,
        finished_mining_public_key: args.finished_mining_public_key,
        mining_public_key: args.mining_public_key,
        network: args.network,
        no_mine: args.no_mine,
        port: args.port,
        simnet: args.simnet,
        tls: args.tls,
      },
      cbk);
    break;
  case 'bitcoind':
    daemon = bitcoincoreTypeDaemon({
        dir,
        daemon: args.daemon,
        network: args.network,
      },
      cbk);
    break;
  default:
    return cbk([400, 'UnknownDaemonType', args.daemon]);
  }

  daemon.stderr.on('data', data => {
    if (/mandatory.script.verify.flag/gim.test(data + '')) {
      return;
    }

    if (/txn.already.in.mempool/gim.test(data + '')) {
      return;
    }
  });

  process.on('uncaughtException', err => {
    daemon.kill();
    process.exit(1);
  });

  return;
};

