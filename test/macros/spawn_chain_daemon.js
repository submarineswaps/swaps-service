const removeDir = require('rimraf');
const uuidv4 = require('uuid').v4;

const bcoinTypeDaemon = require('./bcoin_type_daemon');
const bitcoincoreTypeDaemon = require('./bitcoincore_type_daemon')
const btcsuiteTypeDaemon = require('./btcsuite_type_daemon');
/** Spawn a chain daemon for testing on regtest

  This method will also listen for uncaught exceptions and stop the daemon
  before the process dies.

  {
    daemon: <Daemon Type String>
    [is_tls]: <Uses TLS Bool> // only supported for btcsuite type
    [listen_port]: <Listen Port Number> // only supported for btcsuite type
    [mining_public_key]: <Mining Public Key Hex String>
    network: <Network Name String>
    [rpc_port]: <Rpc Port Number> // only supported for btcsuite type
  }

  @returns via cbk
  {
    daemon: <Daemon Child Process Object>
    dir: <Data Dir Path String>
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
  const dir = `/tmp/${uuidv4()}`;

  switch (args.daemon) {
  case 'bcash':
  case 'bcoin':
    daemon = bcoinTypeDaemon({dir, network: args.network}, cbk);
    break;
  case 'btcd':
  case 'ltcd':
    daemon = btcsuiteTypeDaemon({
      dir,
      daemon: args.daemon,
      is_tls: args.is_tls,
      listen_port: args.listen_port,
      mining_public_key: args.mining_public_key,
      network: args.network,
      rpc_port: args.rpc_port,
    },
    (err, res) => {
      if (!!err) {
        return cbk(err);
      }

      return cbk(null, {dir, daemon: res.daemon});
    });
    break;
  case 'bitcoind':
    daemon = bitcoincoreTypeDaemon({
      dir,
      daemon: args.daemon,
      network: args.network,
    },
    (err, res) => {
      if (!!err) {
        return cbk(err);
      }

      return cbk(null, {dir, daemon: res.daemon});
    });
    break;
  default:
    return cbk([400, 'UnknownDaemonType', args.daemon]);
  }

  daemon.stderr.on('data', data => {
    if (/mandatory.script.verify.flag/gim.test(data+'')) {
      return;
    }

    if (/txn.already.in.mempool/gim.test(data+'')) {
      return;
    }

    console.log(`${data}`)
  });

  daemon.on('close', code => removeDir(dir, () => {}));

  process.on('uncaughtException', err => {
    console.log('CHAIN ERROR', err);
    daemon.kill();
    process.exit(1)
  });

  return;
};

