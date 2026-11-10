# Recovery implementation

This implements the findings in [the investigation](recovery-investigation.md) without
upgrading dependencies or changing the wallet seed, derivation paths, or stored formats.

`seedRecovery.ts` uses the installed cashu-ts public wallet/keychain APIs to load and
validate active and inactive SAT keysets. It replaces the previous SDK private-service
override and ineffective key-preload branch. Selected mints remain serialized by the
existing recovery coordinator; background receiving/maintenance is still paused and
operation navigation guards remain enabled.

Each keyset scans from counter zero in 200-output batches. A nonempty batch continues
the scan; one empty batch stops it, preserving the previous gap behavior. No historical
keysets are skipped. Legacy BIP32 shares a keyset-parent derivation and derives the
secret/blinding-factor pair together. HMAC derivation remains library-owned. Output
generation yields after every eight outputs. Tests compare resulting secrets, blinding
factors, and blinded messages with both the root library and Coco's nested 3.3.0 library,
including counter zero, batch boundaries, base64 legacy IDs, and modern keysets.

Restored signatures are unblinded with library validation. Signature indices are
checkpointed monotonically before spend-state checks, including a signature at index
zero. Only complete, uniquely matched NUT-07 UNSPENT results can add spendable proofs.
PENDING proofs are not credited and produce a partial result; SPENT proofs are not added.
Verified SPENT local ready proofs are marked spent without releasing in-flight proofs.

Each save is transactional. Existing proofs in any state are deduplicated, duplicate
response proofs are not reinserted, and counters cannot move backwards. Completed
batches survive a later network/keyset failure. Failed scans never automatically release
reserved proofs. Temporary derived seed bytes are cleared when the scan finishes.

The recovery screen shows a spinner during scanning, and verified batches refresh the
balance before the full scan finishes.
Recovery reuses an unlocked session. If app lock is disabled, no additional authentication
is requested; if enabled and locked, successful authentication is required. Secret reveal,
backup export/restore, deletion, and app-lock behavior elsewhere are unchanged.

Validation includes deterministic compatibility vectors, real SQLite rollback,
deduplication/reservation preservation, index-zero and high-counter handling, scanning
past the first batch, missing/incomplete status responses, historical keysets, partial
results, and recovery authentication policies. No real seed, token, or proof was used.

Android preview/release review is still required for actual duration, first verified
balance, UI responsiveness, biometric cancellation, backgrounding, interrupted recovery,
mint outages, and repeating a scan. Compare the same wallet/mint on the same network.
No end-to-end speedup or seconds-level completion has been measured on a device.

## Timing the remaining delay

The reported comparison on 2026-11-10 was Cashu.me under a minute versus Bey taking
4–5 minutes, with Bey running in a development client connected to Metro and reloaded
after the recovery changes. This confirms a user-observed gap in that configuration;
it does not establish a preview/release timing or prove which phase dominates.

Each mint scan now emits one `[Recovery timing]` JSON line. It identifies the implementation
as `cached-recovery-v5`, records development/runtime indicators, aggregate keyset/batch/output
counts, total time, and phase timings. Output computation and scheduler-yield time are
separate; `outputPreparationMs` includes both and is not additive with those two submetrics.
The proof-state stage includes library preparation as well as its request. Queue/background
waits appear in a separate `[Recovery queue timing]` line. No mint URLs, keyset IDs, seeds,
tokens, proof secrets, signatures, messages, or error objects are included.

Balance refreshes are skipped when a verified batch changed no spendable balance records,
avoiding full-wallet reads and refresh-triggered maintenance on no-op repeat scans.
Signature counter checkpoints, verification, and persistence remain unchanged.

For the next development run, capture the two timing lines after recovery finishes.
For an end-to-end comparison with the installed Cashu.me app, repeat using an ordinary
Bey preview/release APK containing these changes on the same device and network.
Development overhead may matter, but is not assumed to account for the entire delay.

## Signature verification bottleneck

A subsequent development/Hermes run reported 248,178 ms total for one keyset, five
batches, 1,000 prepared outputs and 585 returned signatures. `unblindMs` accounted for
209,144 ms; restore HTTP calls accounted for 2,428 ms. This identifies signature
conversion (which includes DLEQ verification), rather than restore HTTP or output
preparation, as the dominant stage in that run.

The installed cashu-ts `OutputData.toProof` parses a new mint public-key point for every
signature. The curve library caches multiplication tables by point identity, so those
fresh points repeat the same public-key work. `recoveryProofs.ts` now keeps validated
public mint-key points and their precomputed tables within one keyset scan. It uses
cashu-ts `constructProofFromPromise` and `serializeProof`, and preserves DLEQ metadata.
Every supplied DLEQ is still checked. Signature
points are parsed once for verification and unblinding. No secret derivation, scan
coverage, spend-state validation, counter or saving policy changes.

The UI now reports signature verification separately from waiting for the mint.
`keyPrecomputeMs`, `dleqVerificationMs` and `signatureUnblindMs` break down the former
combined stage; these are included in `unblindMs` and must not be added to it.
`dleqSignatures` counts signatures with a supplied DLEQ.

Synthetic tests compare complete proof objects with the installed cashu-ts conversion
for legacy and HMAC outputs, including DLEQ and non-DLEQ signatures. Tampered DLEQs,
wrong keys, malformed points and mismatched keysets must still fail. A local Node
probe confirms the reused public-key tables reduce work; it does not establish the
Android improvement. Capture a new timing line showing `cached-recovery-v5` on the
same mint/device before comparing durations.

The user's v3 Hermes run took 239,399 ms, with 133,885 ms in combined signature
conversion and 118,746 ms specifically in DLEQ verification. The run also had 52,884 ms
outside the previously recorded top-level phases; attributing that time to networking
or cryptography without further measurements would be premature.

V4 keeps all NUT-12 Alice verification equations and scalar validation. It uses noble's
`multiplyUnsafe` only on public signature scalars `s` and `e` and public points, retaining
cashu-ts `hash_e` serialization and constant-time byte comparison. Secret blinding-factor
unblinding continues through cashu-ts's constant-time multiplication. The generator and
all point operations use cashu-ts point instances, avoiding incompatible class identities
when the CJS bundle and ESM noble package coexist.

Tests include the official blind-signature vector, altered public points, zero,
noncanonical and wrong-length scalars, differential proof conversion against cashu-ts,
and a check that variable-time multiplication never receives the secret blinding factor.
No proofs are skipped or accepted without the previous checks.

`seedPreparationMs`, `deriverSetupMs`, `signatureYieldMs` and `batchYieldMs` now account
for seed retrieval/derivation, keyset deriver initialization, and scheduler waits.
`unaccountedMs` excludes nested submetrics when computing the remainder. These timings
do not change seed derivation, scheduling frequency or recovery semantics.

References: [NUT-12 equations and vectors](https://github.com/cashubtc/nuts/blob/main/12.md),
[noble public-scalar multiplication](https://github.com/paulmillr/noble-curves/blob/main/src/abstract/curve.ts).

## Recovery UI overhead

The user's v4 development/Hermes run completed without partial recovery in 94,368 ms,
with 800 prepared outputs and 290 signatures. It recorded 26,548 ms in DLEQ verification,
7,905 ms in public-key precomputation, 16,975 ms in signature-loop scheduler waits and
6,677 ms in balance refreshes. Only 1,331 ms remained unaccounted for. The earlier v3
run had 1,000 outputs and 585 signatures, so these totals are not an equal-work benchmark.

The signature loop yields every eight proofs. Earlier progress updates went through
the persisted wallet store, making mounted screens that subscribe to the entire store
eligible to render. The initial V5 implementation isolated these updates; a matching-count
development run took 85,718 ms with 3,209 ms in signature-loop scheduler waits. Runtime
and network conditions were not controlled, and these are not release measurements.

The final spinner-only UI removes the percentage panel, transient progress store,
per-output preparation callbacks and per-signature presentation updates entirely.
Wallet balances, queue state and per-mint results still use the wallet store. The unused
slow-scan UI timer is removed too. Recovery validation, cryptography, scan coverage and
yield frequency are unchanged. Diagnostic phase timings remain available in Metro.

## Single-screen recovery UI

Recover funds keeps the same mint list visible during selection, scanning and results.
Full-row checkboxes select mints; selection is locked while authenticating or recovering.
One existing spinner remains visible during scanning and final balance refreshes. Waiting
mints remain visible, completed scans
have green checks/status text, incomplete/interrupted scans use amber, and failures use red.
A successful zero-balance mint says **No available funds**. Amounts remain
explicitly labelled **Current balance**, rather than claiming all displayed funds were
newly recovered. Balances appear with results; selection rows avoid repeating their checkbox
state in visible text. Changing checkboxes after results starts a fresh review on the same screen.
The status line stays compact, without a hero card, percentage, progress bar or batch details.
Overall success requires every selected mint to finish successfully. Partial results never
produce a green overall success state.

Existing receiving pauses, authentication and operation
navigation guards remain active. Retry targets unfinished selected mints, including an
interrupted mint without a persisted terminal result. Imported wallets keep Skip/Go to Wallet;
all idle exits dismiss the root recovery modal to Home. The root `/recover-funds` route
uses a full-screen modal with a slide-from-bottom transition. Close and Android Back
share the same dismissal path; gestures are disabled and operation guards block exits
during authentication/recovery. The previous Settings URL redirects to the modal and
preserves `mintUrl`. Seed-import handoff pushes the modal over Home once, retaining
a dismissible base screen rather than replacing it with a nested Settings destination.
Home no longer mounts recovery or recovery-review cards. Their component is removed;
seed-import navigation to the recovery screen remains intact. Recovery remains accessible
through Settings → Backup & recovery → Recover funds.

Device review is still required for light/dark themes, enlarged text, narrow devices,
TalkBack, Android back, biometric cancellation, offline errors and interrupted scans.
