# Swaps Service

The swaps service is a system for providing and executing Submarine Swaps.

## Submarine Swaps

Submarine swaps exchange off-chain Lightning tokens for on-chain tokens, using
a simple HTLC to help with atomicity.

## Install

Requirements:

- Redis: cache in-flight swap information
- Bcash Chain Server: Purse BCash
- Bitcoin Chain Server: Bitcoin Core or btcd will work
- Litecoin Chain Server: Litecoin Core or ltcd will work
- BIP 39 seed: running the service without a seed will generate one
- LND: execute Lighting payments

Configure environment variables as necessary.

    export GRPC_SSL_CIPHER_SUITES="HIGH+ECDSA"
    export NODE_ENV="production" // Add this when running in production
    export PORT="HTTP SERVER PORT" // Override default server port (9889)
    export REDIS_URL="redis://username:password@host:port" // Redis service
    export SSS_PORT="HTTP SERVER PORT" // Override server port if PORT not set
    export SSS_CHAIN_BCHTESTNET_RPC_API="user:pass@host:port" // Chain service
    export SSS_CHAIN_LTCTESTNET_RPC_API="user:pass@host:port" // Chain service
    export SSS_CHAIN_TESTNET_RPC_API="user:pass@host:port" // Chain service
    export SSS_CLAIM_BIP39_SEED="bip39 wallet seed" // in-flight claims seed
    export SSS_CLAIM_BCHTESTNET_ADDRESS="bchtestnet addr" // Claim to address
    export SSS_CLAIM_LTCTESTNET_ADDRESS="ltctestnet addr" // Claim to address
    export SSS_CLAIM_TESTNET_ADDRESS="testnet addr" // Override LND claiming
    export SSS_LND_TESTNET_GRPC_HOST="host:port" // LND GRPC API
    export SSS_LND_TESTNET_MACAROON="base64 exported lnd macaroon file"
    export SSS_LND_TESTNET_TLS_CERT="base64 exported TLS cert" // LND TLS cert

## Testing

    npm t // Unit tests

A [bcash installation](https://github.com/bcoin-org/bcash#install) is
required to run bcash bcashregtest tests.

    npm run bcash_bcashregtest // bcashregtest tests

A [bcoin installation](https://github.com/bcoin-org/bcoin#install) is
required to run bcoin bcoinregtest tests.

    npm run bcoin_bcoinregtest // bcoinregtest tests

A [bitcoind installation](https://bitcoin.org/en/full-node#what-is-a-full-node) is
required to run bitcoind_regtest tests.

    npm run bitcoind_regtest // bitcoind_regtest tests

A [btcd installation](https://github.com/btcsuite/btcd#installation) is
required to run btcd regtest tests.

    npm run btcd_regtest // regtest tests

A [ltcd installation](https://github.com/ltcsuite/ltcd#installation) is
required to run ltcd ltcregtest tests.

    npm run ltcd_ltcregtest // ltcregtest tests

