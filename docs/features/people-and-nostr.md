# People and Nostr

People combines accepted contacts, contact requests, persistent one-to-one text chat, profile
discovery and payments. Contact acceptance and mint trust are independent decisions.

## People views

The People tab has two views:

- **Recent** shows accepted conversations ordered by latest local message or payment, with previews,
  timestamps and unread indication.
- **Requests** groups unaccepted incoming activity by person and separately labels accepted contacts'
  payment issues. Invitations count once per person. Blocked people do not create invitations.
  Retryable failures remain queued. Legacy unaccepted profiles remain searchable.

Opening a person shows one conversation containing text and payment cards. The header has Back,
avatar, username and Added/Not added status. Tapping the identity opens a contact bottom sheet with
a large avatar, full address, tap-to-copy npub, copy/share, Check and sync, Delete contact and Block
contact. Sync verifies the address against the saved public key and refreshes profile metadata;
it never retargets the identity. Delete removes accepted status while keeping conversation history
and requiring explicit reacceptance, including in Everyone mode. No QR screen is used here. Legacy
person-details links open the same conversation.

The composer grows to four scaled lines and then scrolls internally, with a secondary icon-only
Send button beside it. **Request** and **Pay** sit below. Sent text is white on dark; received text
uses the secondary surface. Sent payment cards use branded secondary, received cards secondary,
and actionable incoming cards warning colors. Cards show type, primary and secondary currency,
then status. Detailed dates/times appear only in the message/payment details bottom sheet, which
also offers safe copy and relevant retry, acceptance or payment review actions. Tokens/proofs are
never copied as message text. Unknown conversations show **Accept** and **Reject and block** in
place of an enabled composer.

## Contact acceptance and receipt policy

Profiles have `unaccepted`, `accepted` or `blocked` status. **Accept** accepts the person and queues
eligible waiting payments. Successfully publishing an explicitly initiated message, payment or
payment request also accepts its recipient. Searching, drafting, failed publication, opening a
conversation and opening a share link never accept anyone.

Nostr Settings persists **Ask before receiving from unknown people** (default) or **Accept everyone**.
Ask saves unknown senders' messages/offers without redeeming funds, changing balance or reporting
receipt success. Payments responding to the user's own requests follow the same rule. Everyone
accepts unblocked incoming senders and waiting invitations. Returning to Ask does not revoke contacts.
Legacy profiles without incoming activity are not accepted merely by changing this setting.

Blocking preserves records and leaves payments unclaimed. Nostr Settings lists blocked people and
provides **Unblock**. Unblocking restores unaccepted status and requires new explicit acceptance,
including in Everyone mode. Blocking cannot cancel redemption already submitted to the mint.

`nostrClaimService` gates automatic claims, retries, reconnect/startup work and policy changes. It
waits for policy hydration and rechecks contact permission immediately before redemption. Neither
`trustMint` nor forced retry bypasses acceptance. Proof-state refresh also refuses to mark unaccepted
offers claimed. Accepting a person can reveal a subsequent, separate mint-approval requirement.

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
keyed by normalized npub. All legacy contacts/favorites become unaccepted. Version 3 rewrites storage
without favorite fields or maps. Identity metadata and payment history are preserved. Valid nprofile
relay hints are stored separately from the normalized identity. Changing this storage key,
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

- Payments from accepted people and a trusted mint may be claimed automatically.
- Payments from an unknown mint require explicit user approval before the mint is added or the
  token is claimed.
- A locked or not-yet-initialized wallet defers the claim until the wallet becomes available.
- Offline and transient network failures are retried with a persisted delay.
- Non-retryable validation or P2PK failures appear as payment issues under Requests.
- Automatic claims are rate-limited to avoid processing an unbounded burst.
- An already-spent response is treated idempotently so a previously completed claim is not shown
  as a new failure.

After a successful claim, the wallet balance refreshes, matching payment requests are updated,
history is tagged as Nostr activity, and a local notification is sent when notifications are
enabled.

Never change mint trust, P2PK validation, retry classification, or already-spent handling merely
to make a failing payment appear successful. These are security-critical payment semantics.

## Text chat

Outgoing chat follows [NIP-17](https://github.com/nostr-protocol/nips/blob/master/17.md): kind `14`
rumor, kind `13` seal and kind `1059` gift wrap. Sender and recipient copies share the same rumor.
Only the recipient's signed kind `10050` inbox relays receive their copy. Missing inbox relays
produce an actionable error without downgrading encryption. Existing payment transports are retained.

Receiving supports NIP-17 and signed legacy kind `4`. Authentication verifies outer/seal signatures,
seal/rumor identity, recomputed rumor IDs and one-to-one recipient membership. Sender copies record
outgoing activity and never enter incoming claims; explicit self-payments remain incoming. Valid
payments are classified before text. Malformed payment-shaped content never appears as chat text.

Additive migration `016_messages` creates `bey_messages`. `MessageRepository` stores conversation,
logical ID, direction, timestamps, text, read state, publication state and encrypted retry envelopes.
Unique logical IDs deduplicate replayed wraps. Conversations fetch messages in batches of 50. Relays
replay seven days; older locally stored messages remain available.

Publication states are **Sending**, **Sent to relay** and **Failed**, with no delivery/read promises.
Manual retry reuses the saved logical message and ciphertext. Startup marks interrupted sends failed
for manual retry. Subscriptions stop and message memory clears on wallet shutdown. Wallet deletion
removes the message database. Chat is encrypted in transit; local text uses existing database
protection. Chat backup/export and push integration are outside this version.

Sending persists encrypted envelopes and queues the visible bubble before inbox-relay discovery.
The composer clears and becomes available after that local save, while discovery/publication runs
in the background. Discovered relay destinations are saved with the same encrypted envelopes for
retry. Discovery failure leaves a failed message that can be retried without creating a new rumor.

Automated checks include actual SQLite restart/pagination, authenticated transport and relay retry.
Real Bey↔Bey and Bey↔Minibits message/payment tests remain required before declaring interoperability
complete. Follow `docs/testing/nostr-people-checklist.md` for native verification.

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
- `src/state/nostrReceiveSettingsStore.ts` persists the receive policy.
- `src/state/messageStore.ts` holds message summaries and unread state.
- `src/storage/sqlite/repositories/MessageRepository.ts` owns persistent message SQL.
- `src/services/wallet/contactPolicy.ts` owns contact permission and acceptance.
- `src/services/wallet/nostrChatTransport.ts` authenticates and constructs chat envelopes.
- `src/services/api/nostrProfileService.ts` resolves remote profiles.
- `src/services/wallet/nostrService.ts` owns relay and messaging coordination.
- `src/services/wallet/nostrClaimService.ts` owns claim trust, serialization, retry, and completion.
- `src/services/wallet/nostrDiagnosticsService.ts` owns health checks and repair operations.
