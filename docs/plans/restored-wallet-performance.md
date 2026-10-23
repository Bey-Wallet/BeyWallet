# Restored-wallet responsiveness: investigation and fix plan

Investigation date: 23 October 2026.

Status: source audit complete; remediation and device validation have not started.

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

## Proposed remediation sequence

Implement each stage as a focused, independently reviewable change. Record correctness
and responsiveness results before proceeding to the next stage.

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
| Payment, NFC, biometric, and recovery correctness | Not established by this audit                        | Not tested        | Separate correctness checks |

Without tracing, report these as repeatable qualitative observations rather than
invented millisecond improvements. A passing unit test establishes correctness, not
device responsiveness.

## Implementation checklist and open questions

- [x] Record user observations and tested APK identity.
- [x] Audit wallet-dependent background work and shared interaction paths.
- [x] Separate verified code behavior from unconfirmed performance hypotheses.
- [ ] Implement and validate Stage 1.
- [ ] Implement and validate Stage 2.
- [ ] Implement and validate Stage 3.
- [ ] Review Stage 4 separately and obtain approval for recovery-semantic changes.
- [ ] Compare a candidate ordinary preview on the affected restored wallet.
- [ ] Record completed changes, checks, limitations, and remaining symptoms here.

Remaining unknowns include the affected wallet's mint/proof/activity counts, event
replay volume, frequency of balance refreshes, database contention, and time spent in
JavaScript versus native rendering. None requires collecting wallet secrets.

Completion requires both preserved wallet correctness and a repeatable improvement on
the affected restored wallet. Device performance remains unverified until retested.
