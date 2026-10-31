# Restored-wallet responsiveness: investigation and fix plan

Investigation date: 23 October 2026.

Status (27 October 2026): remediation implemented with local regression coverage;
ordinary preview device comparisons remain pending. The findings below describe the
original implementation; the implementation record describes the changes.

Device procedure: [restore, Nostr and Home acceptance checks](../restore-and-home-acceptance.md).
The recovery UX now uses one Settings-style screen for import and manual recovery.
Import finishes initialization and file-data import before opening mint review; scanning
requires an explicit Recover selected mints action, including for files containing proofs.
The import pause transfers from setup to the persisted review session and releases on
Skip or when the entire selected queue settles. Manual recovery pauses only on execution.
Session metadata stores the public wallet identity, candidates, selections, phase and
terminal results; per-keyset progress and runtime callbacks are excluded. Startup validates
the wallet identity before listeners and converts running work to Interrupted without retrying.
Home uses a compact navigation row; the automatic progress sheet and onboarding progress
screen have been removed. Exact-list execution retains the existing coordinator and Cashu
derivation/validation. Results label current balances rather than newly recovered totals.

Device validation and first-balance/total-scan timings remain **pending**. No ordinary
preview build was installed or measured during this implementation. Use the linked device
procedure to record seed/file import, restarted review/interruption, balances/history,
responsiveness and Nostr catch-up. Record the selected mint set and timing origin (explicit
Start) with each measurement; no speedup is claimed.

Local validation for this recovery-screen change: 54 tests passed across 12 focused
suites, including import/file proofs, discovery, handoff, recovery UI/session/queue,
Cashu recovery, Nostr scheduling, Settings navigation, Home and wallet snapshot storage.
Typecheck, button checks, structure checks (72 routes), scoped Prettier and diff whitespace
checks passed. These checks do not substitute for the pending preview-device procedure.

## Observed behavior and baseline

The user tested Android preview **0.2.0 (11)**, built from commit
`90656fa37710e4f3c3925039589394214824fbdd`.
[EAS build](https://expo.dev/accounts/thehussein01/projects/bey-wallet/builds/0c6e4a86-1238-4264-a7ad-d8ac88e7d054).

- Touch feedback, navigation, and bottom-sheet opening felt delayed across most taps.
- The behavior occurred on several capable devices and continued beyond startup.
- The affected wallet was imported using a seed and contained several mints or activity.
- The lag remained after recovery appeared finished and the app was fully restarted.
- A newly created wallet in the same APK subsequently felt normal.
- There is no earlier-version comparison, device trace, or measured latency baseline.

The leading hypothesis is wallet-dependent background and rendering workload. The
observations do not prove a single bottleneck or a seed-derivation problem. They also do
not establish which difference matters most: mint count, proofs, activity, pending
operations, or Nostr identity. A fresh wallet changes several of those factors together.

The user prefers an investigation report first, followed by ordinary preview APK
comparisons if fixes are implemented. USB tracing and a special diagnostic APK are not
part of the agreed approach.

## Verified code findings

### 1. Nostr event bursts and repeated message refreshes

In [nostrService.ts](../../src/services/wallet/nostrService.ts), `SINCE_SECONDS` requests
seven days of events. `_subscribe` starts `_processEvent` for each received event without
an application-level concurrency limit. Event-ID deduplication exists, but its tracking
sets are in memory and are cleared during teardown.

For ordinary messages, processing attempts insertion and calls
`useMessageStore.getState().refresh()`. The insert uses `INSERT OR IGNORE`, but returns no
inserted/unchanged result, so a replayed existing message still reaches the refresh path.
Each refresh reads recent messages and unread counts, replaces store values, and
increments the revision.

An established identity can therefore generate significantly more processing and
updates than a new identity. The actual number and duration of events on the affected
wallet remain unknown.

References: [messageStore.ts](../../src/state/messageStore.ts) and
[MessageRepository.ts](../../src/storage/sqlite/repositories/MessageRepository.ts).

### 2. Repeated proof maintenance after balance refresh

In [walletStore.ts](../../src/state/walletStore.ts), `refreshBalance` schedules both
`autoCheckPendingOnchainQuotes` and `cleanSpentProofs` after interactions.
`cleanSpentProofs` loads every ready proof for the active mint and checks their states.
Unlike the pending-on-chain check, it has no overlapping-run guard.

Closely spaced balance refreshes can initiate overlapping cleanup calls. A funded
wallet has more work here than an empty wallet. Deferring work with
`InteractionManager` does not move JavaScript processing onto another thread.

### 3. Concurrent maintenance for all mints on startup

`walletStore.initialize` schedules keyset repair for all known mints using `Promise.all`.
This repeats on initialization, including after restarting the app. More restored mints
can increase concurrent network requests, database operations, and JavaScript work.

This establishes a scaling risk, not a measured explanation for continuous lag.

### 4. Synchronous persistence and rendering amplification

[sqliteStorage.ts](../../src/storage/sqlite/sqliteStorage.ts) uses synchronous SQLite
writes. The installed Zustand persistence middleware serializes and attempts to persist
after store updates, even when only fields excluded by `partialize` have changed.
Wallet progress and temporary flags can therefore cause redundant snapshot writes.

The configured SQLite busy timeout is 3,000 ms. This is a possible contention wait,
not an observed duration for every write.

[ThemeContext.tsx](../../src/shared/theme/ThemeContext.tsx) and the navigation root use
broad settings subscriptions. The theme context value is recreated on render.
[usePeopleUnreadCounts.ts](../../src/features/people/hooks/usePeopleUnreadCounts.ts)
recomputes counts and normalizes identities on hook renders. These can amplify
activity-driven rendering as wallet data grows.

### 5. Separate recovery timeout lifecycle concern

`walletStore.restoreAllMints` races each restore against a 12-second timeout. Rejecting
the timeout does not cancel the underlying restore. The loop can proceed to another
mint and eventually reinitialize the manager before earlier timed-out work settles.

This can defeat the intended sequential scanning. It does not, by itself, explain lag
that survives a full app restart. Track and fix it separately from responsiveness work.

## Agreed remediation scope

Implement each stage as a focused, independently reviewable change. Record correctness
and responsiveness results before proceeding to the next stage.

## Implementation record — 27 October 2026

The user approved the recovery and Nostr scheduling plan. Recovery remains on the
existing Coco stack, with unchanged derivation, 200-output batches, 200-counter gap,
active/inactive SAT keyset coverage, proof checks and counter handling. No dependency
or native implementation changes were made.

- Both recovery entry points use a shared serialized queue with mint deduplication.
  Slow scans stay exclusive until the underlying scan settles. The 12-second timer
  displays a slow-mint message; it no longer abandons an operation. Partial keyset
  failures remain visible, with saved results retained. Batch completion refreshes
  the existing manager rather than replacing it.
- Seed import acquires the Nostr pause before initialization. Existing-wallet recovery
  pauses incoming event processing and new claims, drains submitted work, and defers
  maintenance. Essential backup mint discovery remains available. Resume respects
  foreground state, authentication, wallet identity and the complete queue.
- Manager cleanup/replacement rejects requests during queued or active scans, pauses
  background processing and invalidates deferred callbacks. Internal keyset-repair
  reinitialization avoids waiting on the claim that requested it. Wallet deletion
  clears recovery UI state before a subsequent wallet starts.
- Nostr events run serially with event-loop yields and queued-ID deduplication. The
  existing seven-day replay window and payment validation remain intact. Same-identity
  starts preserve a healthy listener; reconnect requests coalesce and preserve session
  event deduplication. Routine event/payment-content logs were removed.
- Message insertion reports whether a row was inserted. Duplicate text/payment copies
  skip repeated contact and list updates. Message refreshes use one active read plus a
  trailing read, publishing only changed results and rejecting old-session results.
- Startup keyset repair runs sequentially; proof cleanup is single-flight per mint with
  a trailing run. Maintenance waits through recovery. Theme/navigation subscriptions
  are narrowed. Unchanged serialized wallet snapshots skip SQLite writes; changed
  persistent data still saves synchronously and failed wallet writes are surfaced.
- Loaded recovery keys are reused; missing keys are fetched only for keysets eligible
  for the existing SAT path. Work yields between keysets and mint jobs. JavaScript
  cryptography itself still runs on the JavaScript thread.

Local validation uses synthetic fixtures: slow scans exceeding both former timeouts,
late completion, duplicate requests, partial keyset failures, SDK result retention,
protected proofs/history, maintenance invalidation across wallet changes, Nostr bursts,
failed-event retries, duplicate insertion, active-claim draining, pause/auth/foreground
eligibility, trailing message refreshes and immediate changed-snapshot persistence.
These fixtures verify scheduling and wrapper behavior; they do not establish real-mint
cryptographic correctness or device performance.

The full-suite run exposed four unrelated failing suites, reproduced independently on
an untouched `HEAD` archive using the same installed dependencies: `appearance` (font
expectations), `mint-details-screen` (14 vs 22 icon size), `mint-url-navigation` (missing
Tamagui mock), and `header-navigation` (native NFC emitter mock). These are outside this
change. The reconnect test was updated for the intentional 250-ms coalescing delay.
The final full run reports 146 passing suites and 5 failing suites (1,237 passing tests,
11 failures). The fifth suite, `font-assets`, fails on unrelated working-tree font
replacements missing the full-width yen glyph; its four tests pass on the untouched
archive. Those font files were left untouched by this work.

The final focused recovery/Nostr/storage run passed all 74 tests across 10 suites.
`yarn typecheck`, `yarn check:buttons`, `yarn check:structure` (72 routes), scoped Prettier
checks and `git diff --check` passed.

Changed implementation files are `recoveryCoordinator.ts`, `walletService.ts`,
`initService.ts`, `nostrService.ts`, `nostrClaimService.ts`, `walletStore.ts`,
`messageStore.ts`, `nostrInboxStore.ts`, `MessageRepository.ts`, `sqliteStorage.ts`,
`ThemeContext.tsx`, `RootLayoutNav.tsx`, onboarding `index.tsx` and
the now-removed `RestoreProgressStep.tsx`, the Home recovery entry (now
`RecoveryStatusRow.tsx`), and `RecoverFundsScreen.tsx`.
Regression coverage is in `recovery-coordinator`, `wallet-recovery-service`,
`wallet-recovery-result`, `nostr-work-scheduling`, `nostr-chat-service`,
`nostr-claim-service`, `nostr-relay-settings`, `message-refresh`,
`wallet-snapshot-storage`, and integration `messages` tests.

Device measurements are not available. Before acceptance, compare ordinary preview
builds on the same device, network, mints and affected wallet. Record time until the
first recovered balance, total scan time, responsiveness during scans, and interaction
latency after catch-up settles. Repeat with a fresh wallet. No speedup percentage is
claimed. If cryptography remains dominant, use those results to scope off-thread/native
work separately.

## Product-polish follow-up: shared reduced-motion subscription

`useReducedMotion` now shares native accessibility work across its mounted consumers through
`useSyncExternalStore`. Previously every button/pressable/switch consumer installed a listener
and requested the initial preference separately. A 100-consumer regression fixture reproduced
100 native listener registrations before the change and now asserts one registration and read.

The hook stays reduced until the preference is known, honors live events ahead of stale reads,
removes its listener after the last consumer unmounts, and ignores callbacks from previous
subscription lifetimes. Repeated unchanged events do not re-render consumers. This is a scoped
reduction in setup work; it does not establish the cause or resolution of the reported wallet lag.
No device was attached, so the ordinary preview comparisons below remain pending.
Local validation: 40 reduced-motion, button, pressable, switch, and spinner tests passed, along
with type checking, the button check, scoped formatting, and diff whitespace checks.

## Original remediation stages (reference)

### Stage 1: control Nostr processing

- Bound event processing, initially to one event at a time, and yield between events so
  a replay burst does not monopolize interaction handling.
- Coalesce repeated message refresh requests into one active refresh and one trailing
  refresh when requests arrive while it is running.
- Preserve authentication, validation, deduplication, retry behavior, ordering
  requirements, and wallet-generation guards. Never silently drop events.
- Ensure stopping or switching wallets prevents queued work from updating the next
  wallet. Preserve existing recovery of failed processing.

### Stage 2: coalesce wallet maintenance

- Make proof cleanup single-flight per mint. Combine redundant triggers while ensuring
  proofs changed during an active run receive a subsequent check.
- Process startup keyset repair sequentially while retaining repair coverage for every
  mint and existing error handling.
- Preserve payment-critical verification, pending-operation reconciliation, and proof
  state transitions. Do not skip verification to improve apparent speed.
- Prefer existing Coco abstractions and service boundaries; avoid static lifecycle
  import cycles.

### Stage 3: reduce persistence and rendering amplification

- Avoid state updates when relevant values have not changed.
- Investigate suppressing redundant wallet-snapshot writes while preserving immediate
  durability for changed persistent data. Do not apply blanket debouncing to wallet
  storage or silently discard failed writes.
- Narrow theme/navigation subscriptions and memoize unread calculations using stable
  dependencies.
- Treat shared reduced-motion subscriptions and press styling as secondary candidates.
  Preserve accessibility, reduced motion, disabled/loading behavior, and touch targets.

### Stage 4: address recovery lifecycle separately

- Prevent advancing scans or replacing the manager while previous recovery work remains
  active. Inspect supported cancellation before choosing cancellation versus waiting
  for the underlying operation to settle.
- Preserve derivation, counters, scan coverage, saved proofs, partial results, and
  truthful completion reporting.
- Explain the proposed security-sensitive behavior and obtain explicit approval before
  changing recovery semantics. This reference document does not grant that approval.

## Validation

Use synthetic fixtures only. Never record real seeds, private keys, proofs, credentials,
or message contents in tests, logs, reports, screenshots, or traces.

Automated regression scenarios:

- Event bursts and duplicate/replayed events produce no lost messages or duplicate
  payment execution; failures remain retryable.
- Event processing respects the concurrency limit and wallet-generation boundaries.
- Repeated refresh requests cannot produce overlapping reads or stale final UI state;
  updates arriving during a refresh trigger the trailing refresh.
- Repeated cleanup triggers stay single-flight per mint; changes during a run still
  receive verification, and failure releases the guard for retry.
- Startup repair visits every mint sequentially and retains expected failure handling.
- Persistence retains changed values across restart while redundant updates avoid
  unnecessary work. Authentication and preferences retain existing hydration behavior.
- Late recovery completion cannot overlap a subsequent scan or mutate a replaced
  manager; partial recovery is not shown as complete.

Extend the existing Nostr chat/receive, people/unread, and recovery tests where possible.
Run focused tests first, then `yarn typecheck`, `yarn check:buttons`, and Prettier checks
on changed files. Run `yarn check:structure` if routes or feature files are added, moved,
or deleted. Document unrelated baseline failures separately.

### Ordinary preview APK comparison

Use the same device, comparable network conditions, and the same affected restored
wallet for before/after checks. Compare both cold launch and use after startup settles.
Repeat Home actions, Settings/back navigation, tab changes, sheet opening/dismissal,
and scrolling. Use the fresh wallet as an additional comparison, not as the only
acceptance test.

Do not reset a funded wallet merely to collect a comparison. NFC, biometrics, actual
payments, and recovery correctness require separate device checks. No new APK is
published as part of creating this document.

| Check                                             | Existing preview                                     | Candidate preview | Result / evidence           |
| ------------------------------------------------- | ---------------------------------------------------- | ----------------- | --------------------------- |
| Restored wallet: touch feedback after startup     | User reports delay                                   | Not tested        | Device validation required  |
| Restored wallet: tabs, Settings, and back         | User reports delay                                   | Not tested        | Device validation required  |
| Restored wallet: sheets and scrolling             | Sheet opening reported delayed; scrolling unmeasured | Not tested        | Device validation required  |
| Restored wallet: full app restart                 | Lag reportedly persists                              | Not tested        | Device validation required  |
| Fresh wallet responsiveness                       | User reports normal behavior                         | Not tested        | Retain as comparison        |
| First recovered balance / total scan duration     | Not measured                                         | Not tested        | Same-wallet timing required |
| Responsiveness while recovering / catching up     | User reports lag                                     | Not tested        | Device validation required  |
| Payment, NFC, biometric, and recovery correctness | Not established by this audit                        | Not tested        | Separate correctness checks |

Without tracing, report these as repeatable qualitative observations rather than
invented millisecond improvements. A passing unit test establishes correctness, not
device responsiveness.

## Implementation checklist and open questions

- [x] Record user observations and tested APK identity.
- [x] Audit wallet-dependent background work and shared interaction paths.
- [x] Separate verified code behavior from unconfirmed performance hypotheses.
- [x] Implement Stage 1 with automated regression coverage.
- [x] Implement Stage 2 with automated regression coverage.
- [x] Implement Stage 3 for message updates, wallet persistence and theme/navigation subscriptions.
- [x] Obtain explicit approval and implement recovery lifecycle coordination (Stage 4).
- [ ] Compare a candidate ordinary preview on the affected restored wallet.
- [x] Record completed changes, local checks and limitations here.

Remaining unknowns include the affected wallet's mint/proof/activity counts, event
replay volume, frequency of balance refreshes, database contention, and time spent in
JavaScript versus native rendering. None requires collecting wallet secrets.

Completion requires both preserved wallet correctness and a repeatable improvement on
the affected restored wallet. Device performance remains unverified until retested.
