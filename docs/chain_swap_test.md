# Chain Swap Testing

Based on the `chain_swap_script`, test all cases.

## `claim_success`

1. Generate matching preimage
2. Generate valid signature
3. Spend output

## `claim_fail_sig`

1. Generate matching preimage
2. Present invalid signature
3. Try to spend output, fail

## `refund_too_early`

1. Generate a valid signature
2. Try to spend output with signature before maturity, fail

## `refund_success`

1. Generate a valid signature
2. Try to spend output after maturity, succeed


