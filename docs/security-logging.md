# Wallet diagnostic logging

Wallet seeds, private keys, Cashu tokens and proofs must never appear in console
logs or exception messages. Network/decoder/SQLite errors can contain the original
input, nested request bodies or a stack containing bearer material.

- Proof repository validation still rejects duplicates, missing proofs and
  non-ready reservations, using fixed messages without proof secrets.
- Malformed stored proof metadata and key material use fixed errors rather than
  forwarding parser diagnostics. Invalid payment-request and Nostr-identifier
  errors likewise omit decoder input.
- Wallet, payment, recovery and identity error handlers log the operation context
  without forwarding caught exceptions, their messages, stacks or payloads.
- `walletLogger.ts` is the Coco SDK logging boundary. SDK text and metadata are
  untrusted and discarded. Existing expected-background-error suppression remains;
  other failures produce fixed error/warning messages.
- Existing explicit stage/category diagnostics remain available, such as restore
  preparation stages and claim failure categories. Add diagnostic fields only
  when their values are known safe; do not append raw errors to these records.

This change does not alter proof validation, database parameters, recovery
derivation, payment retries or thrown SDK failures used internally for recovery
decisions. It changes diagnostic output and normalizes repository/decoder errors.
It does not add encryption or remove deliberately exported backup files.

Regression tests inject synthetic bearer material into exceptions and nested SDK
metadata, check that logs/errors omit it, and verify valid reservations still bind
the original proof secret to SQLite.
