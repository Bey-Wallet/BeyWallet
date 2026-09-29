# People and Nostr

The People feature combines saved identities, recent Nostr payment contacts, favorites, profile
discovery, and payments that require attention. It replaces the earlier Contacts experience.

## People views

The People tab has three views:

- **Recents** derives people from saved profiles and Nostr payment interactions. People with recent
  interactions appear first.
- **Favorites** contains people explicitly pinned by the user.
- **Attention** contains incoming payments that need mint approval or manual recovery. Retryable
  network and wallet-readiness failures remain queued and do not require immediate user action.

Opening a person shows the best available Nostr metadata and the Nostr send/receive history linked
to that npub. Favorites sort before non-favorites, followed by most recent interaction and then the
best available display name.

## Identity and discovery

People can be found by npub or NIP-05 identifier. Relay profile metadata may provide a display
name, picture, biography, and claimed NIP-05 identifier.

A NIP-05 badge is shown as verified only when resolution succeeds and the resolved public key
matches the profile's public key. Profile-provided NIP-05 text alone is not proof of ownership.

Profile metadata is cached locally and refreshed when it is missing, incomplete, stale, or when
the user explicitly refreshes it.

## Persistence and upgrades

People are persisted with Zustand through the SQLite storage adapter. The store intentionally
continues using the `bey-contacts-storage` key so existing installations retain their data.

During migration, legacy `contacts` and `favorites` records are normalized and merged into one map
keyed by normalized npub. Existing favorites remain favorites. Changing this storage key,
normalization, or migration behavior is a compatibility-sensitive change and requires a focused
regression test.

## Sending payments

Nostr recipients are resolved to an npub before sending. General NIP-05 identifiers are accepted;
sending is not restricted to the `bey.cash` domain. The payment flow creates ecash locked to the
recipient's Nostr public key and sends it through the configured encrypted Nostr messaging path.

The transaction history stores Nostr recipient metadata so the payment can appear on the person's
detail screen.

## Receiving and claiming payments

Incoming Nostr payments are persisted before claim processing. Claim work is serialized so the
same event is not processed concurrently.

- Payments from a trusted mint may be claimed automatically.
- Payments from an unknown mint require explicit user approval before the mint is added or the
  token is claimed.
- A locked or not-yet-initialized wallet defers the claim until the wallet becomes available.
- Offline and transient network failures are retried with a persisted delay.
- Non-retryable validation or P2PK failures move to Attention for manual action.
- Automatic claims are rate-limited to avoid processing an unbounded burst.
- An already-spent response is treated idempotently so a previously completed claim is not shown
  as a new failure.

After a successful claim, the wallet balance refreshes, matching payment requests are updated,
history is tagged as Nostr activity, and a local notification is sent when notifications are
enabled.

Never change mint trust, P2PK validation, retry classification, or already-spent handling merely
to make a failing payment appear successful. These are security-critical payment semantics.

## Diagnostics

Nostr Settings links to a diagnostics screen that checks these concerns independently:

- The configured NIP-05 identifier resolves to this wallet's public key.
- A signed kind `0` profile is published and advertises the expected NIP-05 identifier.
- The NIP-17 inbox relay list is published with the expected relays.
- Configured relays are reachable at the time of the check.

The overall result is healthy, degraded, or unhealthy. Repair actions are intentionally focused:
profile repair republishes profile metadata, inbox repair republishes the inbox relay list, and
reconnect restarts relay connectivity. A repair should not silently rotate keys or change wallet
recovery state.

## Related source boundaries

- `src/features/people` owns People screens, components, profile caching, and history filtering.
- `src/features/nostr` owns Nostr activity, settings, diagnostics, and claim UI.
- `src/state/peopleStore.ts` owns persisted People state and legacy migration.
- `src/state/nostrInboxStore.ts` owns persisted incoming-event and claim status.
- `src/services/api/nostrProfileService.ts` resolves remote profiles.
- `src/services/wallet/nostrService.ts` owns relay and messaging coordination.
- `src/services/wallet/nostrClaimService.ts` owns claim trust, serialization, retry, and completion.
- `src/services/wallet/nostrDiagnosticsService.ts` owns health checks and repair operations.
