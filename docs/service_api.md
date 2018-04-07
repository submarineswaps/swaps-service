# REST API

## Chain Address Details

    GET /api/v0/address_details/:chain_address

    // Returns JSON
    {
      [data]: <Witness Address Data Hex String>
      [hash]: <Address Hash Data Hex String>
      is_testnet: <Is Testnet Address Bool>
      [prefix]: <Witness Prefix String>
      type: <Address Type String> // Ex: "p2sh"
      version: <Address Version Number>
    }

## Lightning Invoice Details

    GET /api/v0/invoice_details/:lightning_invoice

    // Returns JSON
    {
      created_at: <Created At ISO 8601 Date String>
      currency: <Currency Code String> // Ex: "BTC"
      description: <Payment Description String>
      [destination_label]: <Destination Label String>
      [destination_url]: <Destination Url String>
      [expires_at]: <Expires At ISO 8601 Date String>
      [fiat_currency_code]: <Fiat Currency Code String>
      [fiat_value]: <Fiat Value in Cents Number>
      id: <Invoice Id String> // This is the payment hash
      is_testnet: <Is Testnet Bool>
      tokens: <Tokens to Send Number>
    }

## Find a Swap UTXO

    POST /swap_outputs/
    
    // JSON request body
    {
      redeem_script: <Swap Redeem Script Hex String>
    }

    // JSON result when no swap transaction found:
    {
      fee_tokens_per_vbyte: <Fee Tokens Per VByte Number>
      refund_p2wpkh_address: <Refund P2WPKH Address String>
      timelock_block_height: <Locked Until Height Number>
    }

    // JSON result when swap transaction output found:
    {
      fee_tokens_per_vbyte: <Fee Tokens Per VByte Number>
      refund_p2wpkh_address: <Refund P2WPKH Address String>
      timelock_block_height: <Locked Until Height Number>
      utxo: {
        output_index: <Transaction Output Index Number>
        output_tokens: <Transaction Output Tokens Number>
        transaction_id: <Transaction With Swap Output Id Hex String>
      }
    }

## Create a Swap

    POST /swaps/
    
    JSON request body
    {
      currency: <Currency Code String> // Ex: 'tBTC'
      invoice: <Lightning Invoice String>
      refund_address: <Chain Address String>
    }

    // JSON result
    {
      destination_public_key: <Destination Public Key Hex String>
      invoice: <Lightning Invoice String>
      payment_hash: <Payment Hash Hex String>
      refund_address: <Refund Address String>
      refund_public_key_hash: <Refund Public Key Hash Hex String>
      redeem_script: <Redeem Script Hex String>
      swap_amount: <Swap Amount Number>
      swap_key_index: <Swap Key Index Number>
      swap_p2sh_address: <Swap Chain Legacy P2SH Base58 Address String>
      swap_p2wsh_address: <Swap Chain P2WSH Bech32 Address String>
      timeout_block_height: <Swap Expiration Date Number>
    }

## Check Swap Status

    POST /swaps/:payment_hash/
    
    // JSON request body
    {
      destination_public_key: <Destination Public Key String>
      invoice: <Lightning Invoice String>
      payment_hash: <Payment Hash String>
      redeem_script: <Redeem Script Hex String>
      refund_public_key_hash: <Refund Public Key Hash String>
      swap_key_index: <Swap Key Index Number>
      timeout_block_height: <Timeout Block Height Number>
    }

    // JSON result when swap is waiting for confirmations
    {
      conf_wait_count: <Confirmations to Wait Number>
      output_index: <Output Index Number>
      output_tokens: <Output Tokens Number>
      transaction_id: <Transaction Id Hex String>
    }

    // JSON result when a swap is completed
    {
      payment_secret: <Payment Secret Hex String>
      transaction_id: <Transaction Id Hex String>
    }

