# Swaps Service

The swaps service is a system for providing and executing Submarine Swaps.

## Submarine Swaps

Submarine swaps exchange off-chain Lightning tokens for on-chain tokens, using
a simple HTLC to help with atomicity.

## Testing

    npm t // Unit tests

A [btcd installation](https://github.com/btcsuite/btcd#installation) is
required to run regtest tests.

    npm run btcd_regtest // regtest tests

A [ltcd installation](https://github.com/ltcsuite/ltcd#installation) is
required to run ltcregtest tests.

    npm run ltcd_regtest // ltcregtest tests

