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

Configure environment variables as necessary. You can also create a .env file
with KEY=VALUE instead.

    export GRPC_SSL_CIPHER_SUITES="HIGH+ECDSA"
    export NODE_ENV="production" // Add this when running in production
    export PORT="HTTP SERVER PORT" // Override default server port (9889)
    export REDIS_URL="redis://username:password@host:port" // Redis service
    export SSS_CHAIN_BCH_RPC_API="user:pass@host:port" // Chain service
    export SSS_CHAIN_BCHTESTNET_RPC_API="user:pass@host:port" // Chain service
    export SSS_CHAIN_BITCOIN_RPC_API="user:pass@host:port" // Chain service
    export SSS_CHAIN_LTC_RPC_API="user:pass@host:port" // Chain service
    export SSS_CHAIN_LTCTESTNET_RPC_API="user:pass@host:port" // Chain service
    export SSS_CHAIN_TESTNET_RPC_API="user:pass@host:port" // Chain service
    export SSS_CLAIM_BIP39_SEED="bip39 wallet seed" // in-flight claims seed
    export SSS_CLAIM_BCH_ADDRESS="bch addr" // Claim to address
    export SSS_CLAIM_BCHTESTNET_ADDRESS="bchtestnet addr" // Claim to address
    export SSS_CLAIM_LTC_ADDRESS="ltc addr" // Claim to address
    export SSS_CLAIM_LTCTESTNET_ADDRESS="ltctestnet addr" // Claim to address
    export SSS_CLAIM_TESTNET_ADDRESS="testnet addr" // Override LND claiming
    export SSS_FEE_BASE_BCH_BITCOIN="flat tokens number fee"
    export SSS_FEE_BASE_BCH_LTC="flat tokens number fee"
    export SSS_FEE_BASE_BCHTESTNET_TESTNET="flat tokens number fee"
    export SSS_FEE_BASE_BITCOIN_BITCOIN="flat tokens number fee"
    export SSS_FEE_BASE_BITCOIN_LTC="flat tokens number fee"
    export SSS_FEE_BASE_LTC_BITCOIN="flat tokens number fee"
    export SSS_FEE_BASE_LTC_LTC="flat tokens number fee"
    export SSS_FEE_BASE_LTCTESTNET_TESTNET="flat tokens number fee"
    export SSS_FEE_BASE_TESTNET_TESTNET="flat tokens number fee"
    export SSS_FEE_RATE_BCH_BITCOIN="fee rate in parts per million"
    export SSS_FEE_RATE_BCH_LTC="fee rate in parts per million"
    export SSS_FEE_RATE_BCHTESTNET_TESTNET="fee rate in parts per million"
    export SSS_FEE_RATE_BITCOIN_BITCOIN="fee rate in parts per million"
    export SSS_FEE_RATE_BITCOIN_LTC="fee rate in parts per million"
    export SSS_FEE_RATE_LTC_BITCOIN="fee rate in parts per million"
    export SSS_FEE_RATE_LTC_LTC="fee rate in parts per million"
    export SSS_FEE_RATE_LTCTESTNET_TESTNET="fee rate in parts per million"
    export SSS_FEE_RATE_TESTNET_TESTNET="fee rate in parts per million"
    export SSS_FUNDING_BCH_CONFS="number of confs required"
    export SSS_FUNDING_BCHTESTNET_CONFS="number of confs required"
    export SSS_FUNDING_BITCOIN_CONFS="number of confs required"
    export SSS_FUNDING_LTC_CONFS="number of confs required"
    export SSS_FUNDING_LTCTESTNET_CONFS="number of confs required"
    export SSS_FUNDING_TESTNET_CONFS="number of confs required"
    export SSS_LND_BITCOIN_GRPC_HOST="host:port" // LND GRPC API
    export SSS_LND_BITCOIN_MACAROON="base64 exported lnd macaroon file"
    export SSS_LND_BITCOIN_TLS_CERT="base64 exported TLS cert" // LND TLS cert
    export SSS_LND_LTC_GRPC_HOST="host:port" // LND GRPC API
    export SSS_LND_LTC_MACAROON="base64 exported lnd macaroon file"
    export SSS_LND_LTC_TLS_CERT="base64 exported TLS cert" // LND TLS cert
    export SSS_LND_TESTNET_GRPC_HOST="host:port" // LND GRPC API
    export SSS_LND_TESTNET_MACAROON="base64 exported lnd macaroon file"
    export SSS_LND_TESTNET_TLS_CERT="base64 exported TLS cert" // LND TLS cert
    export SSS_PORT="HTTP SERVER PORT" // Override server port if PORT not set

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

