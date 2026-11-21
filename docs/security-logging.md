# Wallet diagnostic logging

Wallet seeds, private keys, Cashu tokens and proofs must never appear in console
logs or exception messages. Network/decoder/SQLite errors can contain the original
input, nested request bodies or a stack containing bearer material.

- Proof repository validation still rejects duplicates, missing proofs and
  non-ready reservations, using fixed messages without proof secrets.
- Malformed stored proof metadata and key material use fixed errors rather than
  forwarding parser diagnostics. Invalid payment-request and Nostr-identifier
  errors likewise omit decoder input.
- App, wallet, payment, recovery and identity handlers use `appLogger.ts` rather
  than calling the console. Its messages must belong to `appLogMessages.ts`'s
  fixed allowlist; runtime strings, template interpolations and payloads are not
  accepted. Development checkpoints are disabled in release JavaScript.
- Routine render, startup, decoder-success, polling and success chatter is removed
  from development builds too. Only targeted NFC, melt-preparation and recovery
  timing traces remain. Trying another supported token decoder is expected and
  does not produce a warning; a final unsupported token still reports failure.
- Warnings and errors keep only allowlisted error types, bounded numeric protocol
  codes, HTTP status, duration and fixed diagnostic hints. No message, stack,
  cause, getter, JSON hook, wallet identifier, amount, address or token is forwarded.
- Repeated warning/error output is limited to once per event/class/code/status
  per 30 seconds. The console limiter retains at most 100 keys and resets with
  diagnostic history. Failure occurrences are recorded before output suppression.
- `walletLogger.ts` is the Coco SDK logging boundary. SDK text and metadata are
  untrusted. Expected background errors stay quiet in the console but now enter
  the sanitized diagnostic history. Other failures produce fixed messages plus
  safe fields. Melt and NFC checkpoints remain available in development without
  payment payloads or identifiers.
- `dependencyConsoleGuard.ts`, installed by `polyfills.ts`, replaces known Cashu
  witness-parser and patched-keyset console bypasses with fixed warnings and
  suppresses known blinded-message dumps. It never forwards their raw arguments.
  The guard is idempotent and leaves unrelated framework diagnostics intact; it
  is not a blanket sanitizer for arbitrary third-party or native logs.

This change does not alter proof validation, database parameters, recovery
derivation, payment retries or thrown SDK failures used internally for recovery
decisions. It changes diagnostic output and normalizes repository/decoder errors.
It does not add encryption or remove deliberately exported backup files.

Regression tests inject synthetic bearer material into exceptions and nested SDK
metadata, check that logs/errors omit it, and verify valid reservations still bind
the original proof secret to SQLite.

## Adding a diagnostic event

Add a fixed, value-free message to `appLogMessages.ts`, then call `appLogger.debug`,
`warn` or `error`. Warn/error calls may supply the original exception to the safe
boundary, plus a fixed diagnostic operation. Never interpolate data into the message
or add arbitrary fields. A source-boundary test rejects direct console access
outside the logger and dependency guard. No logging dependency or permission is added.

## Android release verification

Use a disposable wallet and a release/preview build running release JavaScript
(`__DEV__ === false`). Capture app-process Logcat while opening the wallet,
switching foreground/background, receiving/sending, testing an unreachable mint,
and importing/exporting a disposable backup. Confirm startup/polling/success debug
events are absent and warnings contain fixed messages plus safe fields only.
Inspect the in-app diagnostic report before restarting: it should retain failure
categories/codes/counts without raw logs. Repeat in the development client to verify
that fixed checkpoints remain usable. Never paste real wallet secrets into Logcat
or a support issue. OS/native and newly introduced dependency logging still needs
device review; unit tests do not establish what an installed build emits.
