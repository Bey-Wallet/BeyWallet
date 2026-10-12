# NFC request payer verification

This milestone covers Bey paying a request discovered over NFC. Request reception and ordinary
token sharing are outside this change. No dependencies, native reader code, HCE patches, or seed
derivation were changed.

## Delivery behavior

Nostr requests use NIP-17 kind-14 JSON inside a signed NIP-59 kind-13 seal and kind-1059 gift wrap.
The NUT-18 payload carries the request ID, mint, unit, and original proofs with full keyset IDs.
Existing mint restrictions, trusted-mint checks, sat-only validation, and redemption fee checks remain.
Unsupported transport, locking, and method requirements fail before preparing funds.

Each publication attempt waits for relay attempts to settle, with a 10-second deadline. When valid
recipient relay hints exist, at least one advertised relay must acknowledge the event. Without hints,
at least one default relay must acknowledge it. Acknowledgement means publication, not redemption.
The installed `nostr-tools` 2.23.3 pool resolves connection failures with a `connection failure: ...` string;
those results count as failures, never acknowledgements.
There are two attempts per delivery call; both use the same encrypted event. A user delivery retry
also retains that event, proofs, and wallet operation. Pending promises have rejection handlers before
connections close; callbacks after cleanup cannot change the attempt's result.

The sheet distinguishes publishing, published and awaiting redemption, delivery unconfirmed, and
confirmed. Confirmation still requires every outgoing proof to be spent and the Coco send operation
to be finalized. The existing 60-second settlement polling limit and pending History entry remain.
Diagnostics include event ID, attempt number, acknowledgement counts by relay category, rejection
count, unfinished count, and timeout status. They contain no payloads, tokens, proofs, or signing keys.

## Peer source review

These are local clone revisions, **not installed app versions**. Receiver tests adapt the reviewed
decryption paths; they do not run the complete peer applications or redeem proofs at a mint.

| Peer           | Reviewed revision                          | Request and receiver contract                                                                                                                                                                                                                                                                                      |
| -------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Numo Pay       | `45d7cfb5a5f7278b5d844b132f1407f6171e058e` | `PaymentRequestActivity.kt` advertises a separate HCE request, stripping transports for BTCPay requests. Bey retains its foreground `NfcPaymentSession.read/write/close` API and same-session token write-back.                                                                                                    |
| Cashu.me clone | `f14b942ea3795a0396ca7ddea19e25a4a7f882be` | `src/stores/payment-request.ts` uses a Nostr nprofile, `n=17`, short UUID request ID, chosen amount/unit and optional mint. `src/stores/nostr.ts` decrypts wrap then seal and parses JSON `id/mint/unit/proofs`. Automatic request receiving defaults off and requires a known mint.                               |
| Minibits       | `b7899a948fe829b321d60f367c289543f4db37ba` | `cashuPaymentRequestApi.ts` advertises nprofile relay hints, `n=17`, random request ID, amount/unit and selected mint. `NostrService.ts` uses `nip59.unwrapEvent`. The reviewed finalizer checks exact gross proof amount against the request amount; fee top-ups may be rejected and require device verification. |
| Sovran         | `2d421e66a0261f5fe69624c86d69e7531dab961f` | `paymentRequestNostrTransport.ts` advertises Nostr nprofile with `n=17`, unwraps kind 1059 using `giftWrapCache`/`nip17.ts`, and passes NUT-18 JSON to Coco's receive service with event ID for deduplication. Amount, unit, ID and mint policy remain owned by the request operation.                             |

Before building, four leftover installed Java changes in `react-native-hce` were restored from the
locked Yarn cache archive for version 0.3.0 (`163cb7187c-644a5cf539`). No HCE patch exists in the
repository's active `patches/` directory. Dependencies and lockfile remain unchanged.

## Local checks and release gate

Targeted Jest checks cover recipient-vs-fallback acknowledgements, slow recipient delivery, rejection,
timeouts, late rejection after cleanup, identical ciphertext retries, peer-style payload decryption,
original keyset IDs, mint/unit checks, net amounts, one operation per payment, partial proof spending,
background/late callbacks, and Numo same-session write-back. TypeScript, scoped Prettier and the
structure check are also required.

Implementation validation: 74 targeted tests across 10 suites passed in focused runs, including
`payment-request-publisher`, `payment-request-payment`, `payment-request-delivery`,
`payment-request-model`, `nfc-flow`, `nfc-payment-session`, `nfc-android-registration`,
`nfc-sheet-dismissal`, `nfc-entry-points`, and `nfc-request-actions`. `yarn typecheck`, scoped
Prettier checks, `yarn check:structure` (35 routes), and `git diff --check` passed.

Android `:app:assembleRelease` completed successfully, including release lint, on October 12, 2026.
The APK is `android/app/build/outputs/apk/release/app-release.apk` (135,384,277 bytes), package
`com.thehussein01.Bey`, native version `1.1.1` / version code `1`. It uses the repository's existing
debug signing configuration. Its embedded bundle contains the new publication diagnostics and NFC
publishing status.

SHA-256: `5ce26e20b7c1acaea495459193c39aa948fbe93ec7b090072476a93ba33de898`.

The Windows build needed temporary short drive paths, reduced build concurrency, regenerated Expo
plugin outputs, and removal of stale Screens Ninja dependency caches containing obsolete long paths.
No repository build configuration or native source was changed. Metro reported package-export
fallback warnings through the existing `bip39` 3.1.0 and `@gandlaf21/bc-ur` 1.1.12 dependencies
(including `cborg` 4.5.8 and nested `@noble/hashes`). Export resolution remains enabled and these
dependencies remain locked to their existing versions.

No Android device was attached during implementation (`adb devices` returned an empty list).
The exact installed Cashu.me Android package/version is therefore **unknown**. Observed payments
and settlement on all four peers remain release requirements; passing mocks and building an APK
alone do not establish interoperability. Numo compatibility is a release gate.

For each device run, record both phone models, Android versions, Bey APK hash/version, recipient
package ID and version, peer source revision if known, request amount/unit/mint policy, relay hints,
and the observed recipient balance increase and Bey operation finalization. Never record proofs,
tokens, payment payloads, or private keys.

1. Pay a sat request from each peer using a mutually accepted mint. Confirm recipient balance
   increase and Bey settlement; for Numo, verify read and write use the same NFC session.
2. For Cashu.me Android, record `adb shell dumpsys package <package>` version fields and test with
   automatic receive enabled and a known mint; also check the manual acceptance flow.
3. Delay recipient relay connectivity while a default relay acknowledges quickly. Verify Bey waits
   and only reports publication success after an advertised recipient relay acknowledges.
4. Reject or disconnect advertised relays. Verify delivery remains unconfirmed in History. Retry
   delivery and verify the same event ID and operation ID, with no new payment debit.
5. Repeat taps and background/reopen during delivery. Verify one payment and safe late callbacks.
6. Leave only some proofs spent. Verify Bey stays pending and never reports confirmation.
7. Test fee-bearing requests, especially the reviewed Minibits gross-amount restriction. Do not
   relax Bey's net-value checks to satisfy a receiver.

If pending persists, correlate the safe event ID with recipient receipt, successful decryption,
request-ID matching and redemption, then check all proof states and operation finalization before
making further code changes.
