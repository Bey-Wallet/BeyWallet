# Mint transfer verification

Transfers use the existing Coco BOLT11 mint/melt operations. The amount entered is the
amount arriving at the destination; fees are additional. Review shows the maximum fee
and source debit before payment. Changing the amount or either mint discards the unused
preparation. No intermediary mint is selected automatically.

The local `bey_mint_transfers` journal links the two quote IDs and source operation ID.
The raw Coco history is preserved, while the source payment becomes one Transfer row.
The matching destination receipt is hidden before pagination. Legacy records are not
inferred from amount or time and are left unchanged.

Quote loading ends after 20 seconds with a preparation error. A submitted payment that
takes longer becomes a pending receipt; timing out never submits another payment. The
transfer completes only when the source operation is finalized and the destination
quote is issued. Paid fees replace the maximum fee when the source quote is available.
Pending transfers cannot be erased. Prepared operations can be discarded; submitted
proofs stay under Coco's existing settlement and recovery handling.

## Automated checks

Run the mint-transfer integration tests, transfer-result tests, history-list tests,
SQLite migration tests, typecheck, and structure check. Integration tests cover stalled
requests, late quote responses, repeated confirmation, lost payment responses, fee
shortfalls, expiry, mismatched quotes, abandoned preparations, issuance delays, restart,
stable transaction IDs, filters, pagination, and unrelated payments.

## Android device checks

- Transfer between two trusted Lightning-capable mints. Check the quoted destination
  amount, maximum fee, total, both balance changes, and final receipt.
- Interrupt networking during quote creation: the loader must end, and a late quote
  must never trigger payment.
- Interrupt networking after confirmation: show Transfer pending, permit dismissal
  after handoff, and keep a single history row. Reconnect and foreground the app to
  reconcile the original operation.
- Kill and reopen during payment and during destination issuance. Verify completion
  without a second source payment and with the same history transaction ID.
- Test insufficient balance including fees, source routing failure, expired review,
  repeated taps, Android back, modal dismissal, and backgrounding while submitting.
- Reopen pending, completed, and failed transfers from History. Check source/target
  names, timestamp, fee label, status refresh, mint filters, and separation from
  independent equal-value Lightning payments.
- Confirm startup and lazy-loaded global checkers on the development build. The reported
  `fetchThenEvalJs` SyntaxError needs an on-device check of the actual Metro response;
  an Android export validates the bundled source separately.

Reference behavior: cashu.me Android's `WalletMintTransferService.kt` and
`MintTransferProjection.kt` in <https://github.com/cashubtc/wallet>.
