const asyncPriorityQueue = require('async/priorityQueue');
const EventEmitter = require('events');

const blockListener = require('./block_listener');
const detectSwaps = require('./detect_swaps');
const mempoolListener = require('./mempool_listener');

const jobQueues = [];
const maxChecksCount = 3;
const {MIN_SAFE_INTEGER} = Number;
const staleBlockTxTime = 1000 * 60 * 5;
const staleMempoolTxTime = 1000 * 60 * 10;

/** The swap output scanner is an event emitter for swap outputs

  When instantiated the scanner will start looking for relevant swap outputs.

  Notifications:
  - Claim transaction has entered the mempool, has confirmed
  - Funding transaction has entered the mempool, has confirmed
  - Refund transaction has entered the mempool, has confirmed

  The scanner is non-authoritative, since it uses an expiring cache backend it
  may miss some events.

  {
    cache: <Cache Type String>
    network: <Network Name String>
  }

  @throws
  <Error> when scanner instantiation fails

  @returns
  <Swap Output EventEmitter Object>

  // Notification that a claim transaction is seen for a swap
  @event 'claim'
  {
    [block]: <Block Hash String>
    id: <Transaction Id String>
    invoice: <BOLT 11 Invoice String>
    network: <Network Name String>
    outpoint: <Outpoint String>
    preimage: <Preimage Hex String>
    script: <Redeem Script Hex String>
    type: <Type String> // 'claim'
  }

  // Notification that an error was encountered by the scanner
  @event 'error'
  <Error>

  // Notification that a funding transaction is seen for a swap
  @event 'funding'
  {
    [block]: <Block Hash String>
    id: <Transaction Id String>
    index: <HD Seed Key Index Number>
    invoice: <BOLT 11 Invoice String>
    network: <Network Name String>
    output: <Output Script Hex String>
    script: <Redeem Script Hex String>
    tokens: <Token Count Number>
    type: <Type String> // 'funding'
    vout: <Output Index Number>
  }

  // Notification that a refund transaction is seen for a swap
  @event 'refund'
  {
    [block]: <Block Hash String>
    id: <Transaction Id String>
    invoice: <BOLT 11 Invoice String>
    network: <Network Name String>
    outpoint: <Spent Outpoint String>
    script: <Redeem Script Hex String>
    type: <Type String> 'refund'
  }
*/
module.exports = ({cache, network}) => {
  if (!cache) {
    throw new Error('ExpectedCacheTypeForScanCaching');
  }

  if (!network) {
    throw new Error('ExpectedNetworkName');
  }

  const scanner = new EventEmitter();

  const listeners = [
    blockListener({cache, network}),
    mempoolListener({network}),
  ];

  const queueLength = () => {
    return jobQueues.map(n => n.length()).reduce((sum, n) => sum + n, 0);
  };

  const detectJobs = asyncPriorityQueue(({
    block,
    cache,
    date,
    id,
    network,
  },
  cbk) => {
    return detectSwaps({block, cache, id, network}, (err, detected) => {
      if (!!err) {
        return scanner.emit('error', err);
      }

      // Notify on all found swaps
      detected.swaps.forEach(swap => {
        switch (swap.type) {
        case 'claim':
          scanner.emit(swap.type, {
            block,
            id,
            network,
            index: swap.index,
            invoice: swap.invoice,
            outpoint: swap.outpoint,
            preimage: swap.preimage,
            script: swap.script,
            type: swap.type,
          });
          break;

        case 'funding':
          scanner.emit(swap.type, {
            block,
            id,
            network,
            index: swap.index,
            invoice: swap.invoice,
            output: swap.output,
            script: swap.script,
            tokens: swap.tokens,
            type: swap.type,
            vout: swap.vout
          });
          break;

        case 'refund':
          scanner.emit(swap.type, {
            block,
            id,
            network,
            index: swap.index,
            invoice: swap.invoice,
            outpoint: swap.outpoint,
            script: swap.script,
            type: swap.type,
          });
          break;

        default:
          scanner.emit('error', [500, 'UnknownSwapType']);
          break;
        }
      });

      return cbk();
    });
  },
  maxChecksCount);

  jobQueues.push(detectJobs);

  // Both block listeners and mempool listeners emit transaction ids when they
  // detect new transactions.
  listeners.forEach(listener => {
    listener.on('error', err => scanner.emit('error', err));

    listener.on('transaction', ({block, id}) => {
      const date = Date.now();

      // Newer transactions are more likely to be hits, newer gets priority
      // Block transactions are fast to lookup, they get ultimate priority
      const priority = !!block ? MIN_SAFE_INTEGER : 1e8 - detectJobs.length();

      // Eliminate existing jobs that match this job
      detectJobs.remove(({data}) => data.id === id);

      // Eliminate mempool jobs that have been around a long time
      detectJobs.remove(({data}) => {
        const timeInQueue = Date.now() - data.date;

        if (!data.block && timeInQueue > staleMempoolTxTime) {
          return true;
        }

        return false;
      });

      return detectJobs.push({block, date, cache, id, network}, priority);
    });

    return;
  });

  return scanner;
};

