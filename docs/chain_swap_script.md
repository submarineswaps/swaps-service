# Chain Swap Script

The on-chain swap script defines how the tokens are sent to be compensated for
the payment of an off-chain invoice.

## Pseudocode

We have 2 parties, Alice and Bob: Alice can pay an invoice with off-chain
tokens, Bob wants Alice to pay this invoice so he pays her with on-chain tokens
that are only redeemable by Alice if she makes the off-chain payment.

As a failsafe, we want Bob's tokens to return back to him after a while if
Alice fails to make the payment.

It would also be nice if Alice can help Bob by refunding his tokens before the
timeout. It would also be nice if Bob can use a pkhash instead of his public
key for his refund.

### Simple Case

What would a simple script look like for the locking condition?

    let controllingKey;
    
    if (hash256(preimage) === paymentHash) {
      controllingKey = alicePubKey;
    } else if currentTime > refundTimeLock {
      controllingKey = bobPubKey;
    } 
       
    return validSignature(controllingKey)

In Script this will look different, the witness signature will be either a
signature from Alice and the payment preimage, or it will be the signature from
Bob.

    // WITNESS SCRIPT
    OP_SHA256 <paymentHash> OP_EQUAL
    OP_IF
      <alicePubKey>
    OP_ELSE
      <cltvExpiry> OP_CHECKLOCKTIMEVERIFY OP_DROP <bobPubKey>
    OP_ENDIF
    OP_CHECKSIG
    
    // HEX (20 = pushdata 32, 21 = pushdata 33)
    A8 20 0000000000000000000000000000000000000000000000000000000000000000 87
    63
       21 000000000000000000000000000000000000000000000000000000000000000000
    67
       03 FFFF07 B1 75
       21 000000000000000000000000000000000000000000000000000000000000000000
    68
    AC

Here is a simple version of the locking condition. It requires Alice to present
a payment hash matching payment preimage in order to place her pubkey on the
stack to be eventually checked for payment.

In the refund case, Bob presents a dummy payment preimage to trigger the else
clause, which then further verifies the timeout has been exceeded and puts his
public key on the stack to check his signature.

All cases:

1. `claim_success`: Alice presents a matching preimage and valid signature.
2. `claim_fail_sig`: A valid claim preimage is presented, but not Alice's sig.
3. `refund_too_early`: The refund branch is entered too early.
4. `refund_success`: Bob presents a valid signature after the refund delay.

`claim_success`:

    <aliceSig> <paymentPreimage>
    OP_SHA256 <paymentHash> OP_EQUAL # <preimage> matches, leaves OP_1 on stack
    OP_IF
      <alicePubKey>
    OP_ELSE
      # Path Not Taken
    OP_ENDIF
    OP_CHECKSIG # Only <alicePubKey> on the stack, check against <aliceSig> = 1

`claim_fail_sig`:

    <badSig> <paymentPreimage>
    OP_SHA256 <paymentHash> OP_EQUAL # <preimage> matches, leaves OP_1 on stack
    OP_IF
      <alicePubKey>
    OP_ELSE
      # Path Not Taken
    OP_ENDIF
    OP_CHECKSIG # Fails check against <badSig> = 0

`claim_fail_preimage`

    <aliceSig> <badPaymentPreimage>
    OP_SHA256 <paymentHash> OP_EQUAL # <preimage> doesn't match, stack -> OP_0
    OP_IF
      # Path Not Taken
    OP_ELSE
      <cltvExpiry> OP_CHECKLOCKTIMEVERIFY OP_DROP # Maybe fail here, or...
      <bobPubKey> # <bobPubKey> is pushed onto the stack
    OP_ENDIF
    OP_CHECKSIG # Fails check against <aliceSig> -> OP_0

`refund_too_early`:

    <bobSig> OP_0
    OP_SHA256 <paymentHash> OP_EQUAL # <preimage> doesn't match
    OP_IF
      # Path not taken
    OP_ELSE
      <cltvExpiry> OP_CHECKLOCKTIMEVERIFY
      # Fails here because <currentHeight> is less than <cltvExpiry>

`refund_success`:

    <bobSig> OP_0
    OP_SHA256 <paymentHash> OP_EQUAL # <preimage> doesn't match
    OP_IF
      # Path not taken
    OP_ELSE
      <cltvExpiry> OP_CHECKLOCKTIMEVERIFY OP_DROP
      <bobPubKey> # <bobPubKey> is pushed onto the stack
    OP_ENDIF
    OP_CHECKSIG # Only <bobPubKey> on the stack, check against <bobSig> = 1

### PKHash Case

What if we wanted to have a pkhash check instead of a pubkey check? This is
potentially nice because when Bob hands over his invoice to pay and refund info
he can hand over a normal Bitcoin address, as long as it is a p2pkh.

The altered script for a pkhash looks like:

    <bobSig> <bobPubKey>
    OP_DUP OP_SHA256 <paymentHash> OP_EQUAL
    OP_IF
      OP_DROP # We dont need the DUP preimage for anything
      <alicePubKey>
    OP_ELSE
      <cltvExpiry> OP_CHECKLOCKTIMEVERIFY OP_DROP
      OP_DUP # Save another copy of the pubKey for use after the hash check
      OP_HASH160 <bobPkHash> OP_EQUALVERIFY
    OP_ENDIF
    OP_CHECKSIG

This variant adds 24 witness bytes to the redemption but might be more
convenient.

