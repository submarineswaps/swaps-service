const swapScanner = require('./swap_scanner');

/** Create swap scanners

  {
    cache: <Cache Type String>
    found: <Found Swap Function> ({swap}) => ()
    log: <Log Function> (err) => ()
    networks: [<Network Name String>]
  }

  @throws
  <Scanner Instantiation Error>

  @returns
  [<Scanner Object>]
*/
module.exports = ({cache, found, log, networks}) => {
  if (!cache) {
    throw new Error('ExpectedCacheForScanners');
  }

  if (!found) {
    throw new Error('ExpectedFoundFunction');
  }

  if (!log) {
    throw new Error('ExpectedLogFunctionForScanners');
  }

  if (!Array.isArray(networks)) {
    throw new Error('ExpectedNetworksToCreate');
  }

  return networks.map(network => {
    let scanner;

    const startScanner = () => {
      scanner = swapScanner({cache, network});

      scanner.on('claim', swap => found({swap}));
      scanner.on('error', err => {
        log(err);

        return setTimeout(startScanner, 1000);
      });
      scanner.on('funding', swap => found({swap}));
      scanner.on('refund', swap => found({swap}));

      return;
    };

    startScanner();

    return scanner;
  });
};

