# Chain Support

Supporting a new on-chain target for the swap pairs requires that the on-chain
target be supported by having defined magic values, defined network
characteristics, and by having a connected chain daemon that supports the
standard daemon RPC API calls.

## Network Magic Values

Network magic values are defined in `tokenslib` which is an extension of
`bitcoinjs-lib` that supports additional token networks.

The network JSON format is: (`[]` indicates non-required attribute)

    {
      [fork_id]: "<Hex Encoded SigHash Modification String>"
      [is_cash_address_network]: <Network Uses CashAddr Format Bool>
      [is_segwit_absent]: <Network Does Not Enforce SegWit Bool>
      ms_per_block: <Milliseconds Per Block Number>
      prefix: {
        [bech32]: <Bech32 Address Human Readable Prefix String>,
        bip32_private_key: <BIP32 Private Key Prefix Hex String>
        bip32_public_key: <BIP32 Public Key Prefix Hex String>
        message_prefix: <Message Signing String>
        p2pkh: <Pay to Public Key Hash Address Prefix Hex String>
        p2sh: <Pay to Script Hash Address Prefix Hex String>
        wif: <WIF Private Key Encoding Prefix Hex String>
      }
    }

## Network Daemon Definition

    export SSS_CHAIN_UPPERCASENETWORKNAME_RPC_API="user:pass@host:port"
    export SSS_CLAIM_UPPERCASENETWORKNAME_ADDRESS="addr" // Claim to address

