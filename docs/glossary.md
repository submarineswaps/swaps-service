# Glossary of Terms

Quick outline of short-hand terms used in the swaps.

## `claim_fail_preimage`

Hitting **claim fail preimage** is the normal case for refund success and the
failure case for `refund_success`. This means the preimage was incorrect.

## `claim_fail_sig`

When **claim fail sig** is encountered, this means that the sweep of funds for
a swap fails because a correct preimage is presented but the claim sig is bad.

## `claim_success`

A **claim success** is an outcome of a swap scenario in which the chain funds
were successfully swept with the preimage of the off-chain HTLC.

## `refund_success`

The **refund success** case happens when the swap is cancelled by waiting out
the locktime.

## `refund_too_early`

If the depositor attempts to pull out of the swap too early, they hit a
**refund too early** case and are blocked by the `OP_CLTV` condition.

## `swap_address`

A **swap address** is an address that chain funds are deposited into and locked
to a preimage and a remote key, or a refund key after a timeout.

