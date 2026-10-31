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

The header displays **People**, the wallet's profile avatar, and Nostr Settings. Connection
diagnostics remain in Settings; the People header does not poll diagnostics or show a relay
percentage. A permanent **Search people** field offers Paste/Clear. Recent and Requests are
tap-based, equal-width tabs; only Requests has an actionable-count badge.

People rows use circular 48px avatars, verified badges, a name and latest-activity preview, compact
timestamps, and an unread dot. Tapping anywhere on a row opens its conversation. Pay/Request live
in that conversation rather than as competing row actions. Accepted people without activity sort
alphabetically after active conversations. Requests separates People requests and Payment issues;
issue rows open the existing claim review sheet without starting a claim.

The active view uses a virtualized list, loading rows in batches of 50 and retaining each tab's
scroll position across tab switches and search. Search shows **On this wallet** before **Other
people**, deduplicated by normalized identity. Local matches remain visible during remote loading
or failure, and remote search can be retried. Clearing search restores the prior tab. Pull-to-refresh
reloads saved profiles, messages, and payment history, with an inline error if part of it fails.

`peopleListModel` groups sources once per identity and derives ordering and previews from the same
latest conversation activity. Preview models contain display metadata and IDs, never payment
tokens/proofs. Wallet history loads beyond the first page so older tagged activity is not mistaken
for an unused contact. Monetary previews follow the primary currency setting, falling back to sats
when no fiat rate is available. The shared profile picker used by Send is unchanged.

Opening a person shows one conversation containing text and payment cards. The header has the
standard modal close control, avatar, username, contact-status icon and Info action. Verified NIP-05
identities display their verification badge. Both the identity and Info open a contact bottom sheet with
a large avatar, full address, tap-to-copy npub, copy/share, Check and sync, Delete contact and Block
contact. Sync verifies the address against the saved public key and refreshes profile metadata;
it never retargets the identity. Delete removes accepted status while keeping conversation history
and requiring explicit reacceptance, including in Everyone mode. No QR screen is used here. Legacy
person-details links open the same conversation. The public key and contact actions use ListTable
rows, with an inline copy icon for the full npub and disabled rows while syncing or when an action
does not apply.

The composer grows to four scaled lines and then scrolls internally, with a secondary icon-only
Send button beside it. **Request** and **Pay** float above it at their natural widths. Sent text uses branded primary; received text
uses the secondary surface. Sent payment cards use branded secondary, received cards secondary,
and actionable incoming cards warning colors. Cards show type, primary and secondary currency,
then status. Detailed dates/times appear only in the message/payment details bottom sheet, which
also offers safe copy and relevant retry, acceptance or payment review actions. Tokens/proofs are
never copied as message text. New conversations initiated by the user offer **Add contact**;
incoming invitations show **Accept** and **Reject and block** in place of an enabled composer.

Payment types use banknote (ecash), bolt (Lightning), and hand-with-coins (ecash request) icons.
Incoming actionable payment requests have an adjacent secondary Pay button. It opens the existing
review/confirmation flow, stays disabled before acceptance or when blocked, and is hidden for
completed/dismissed requests. Paying is never triggered by opening or displaying a card.

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
- An already-spent response requires an exact successful local receive record before it is treated
  as received. Matching checks the complete original proof set, mint, unit, and amount; neither
  mint proof state alone nor an unrelated same-amount transaction proves receipt ownership.
- Missing evidence is shown as **Receipt unverified**, with no received notification or request
  completion. Verify receipt checks history and proof state without submitting another redemption.
- Recovered receipts retain their actual redemption time. Replaying an old token cannot satisfy
  a newer request or reassign an existing receipt's sender/event metadata.
- Inbox upgrades move older unverified claimed offers into receipt review. Exact local receipts
  restore verified status without duplicate receipt notifications. Fresh successful redemptions
  persist their verification. Previously saved request outcomes are preserved rather than guessed
  or reversed from amount matching.

After a successful claim, the wallet balance refreshes, matching payment requests are updated,
history is tagged as Nostr activity, and a local notification is sent when notifications are
enabled.

Never change mint trust, P2PK validation, retry classification, or already-spent handling merely
to make a failing payment appear successful. These are security-critical payment semantics.

## Text chat

Outgoing chat defaults to [NIP-17](https://github.com/nostr-protocol/nips/blob/master/17.md): kind `14`
rumor, kind `13` seal and kind `1059` gift wrap. Sender and recipient copies share the same rumor.
Only the recipient's signed kind `10050` inbox relays receive their copy. Missing inbox relays
produce an actionable error without downgrading encryption. Existing payment transports are retained.

Conversation Info → Messaging offers an explicit legacy NIP-04 choice for older clients. The
choice is persisted per person, defaults to NIP-17 for existing/new contacts, and survives profile
refreshes. The chooser explains that legacy messages encrypt content but publicly expose sender,
recipient and timestamp; a notice remains above the composer while legacy mode is selected.
Legacy chat publishes one signed kind `4` event to the configured relays and recipient relay hints,
without requiring a NIP-17 inbox list or publishing a gift wrap. Relay overlap is still required;
discovering a profile alone does not guarantee delivery. The outgoing event ID is the local message
ID. Both formats retain existing blocking, authentication, contact acceptance and publication
checks. Switching formats affects new messages only: retries retain their original encrypted event,
ID and destinations, and never downgrade an already-created NIP-17 message. Legacy outgoing chat
is stored locally without a separate sender gift wrap. Existing Pay/Request transports are unchanged.

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

Sending immediately displays a temporary Sending bubble and clears the composer, before encryption
or local storage completes. Local persistence replaces that temporary bubble with the saved message
and enables the next send while discovery/publication runs in the background. A failure before
persistence removes the temporary bubble and restores its draft, preserving newly typed text.
Discovered relay destinations are saved with the same encrypted envelopes for
retry. Discovery failure leaves a failed message that can be retried without creating a new rumor.

The timeline uses explicit text/payment activity kinds. Nullable payment columns are normalized on
database reads; ordinary text never becomes a zero-amount card. Missing payment amounts display
“Amount unavailable”, while genuine zero amounts remain zero. Sent text uses branded primary;
received text uses secondary. Compact payment cards use neutral secondary surfaces, with warning
secondary for actionable incoming items. All corners are equally rounded at 16px. Payment type,
primary currency, secondary currency and status remain visible; timestamps live in the details sheet.

The conversation uses the standard circular modal close control, an added-contact icon and an Info
button for the contact sheet. A conversation opened without incoming activity offers Add contact;
Accept / Reject and block are reserved for incoming invitations. Pay and Request use their natural
widths in a floating row above the composer. Payment cards also size to their contents.

The latest 50 mixed activities load at the bottom. Scrolling upward loads older local messages and
payments while preserving the visible position. Centered calendar-date pills separate days.
Standalone Lightning invoices, LNURL, Lightning addresses, Bitcoin URIs and Cashu requests are
recognized as payment content. Recognition does not fetch or redeem anything; an explicit review
action opens the existing payment flow for validation and confirmation. Unsupported BOLT12 offers
remain labeled unsupported. No playground or development preview is included.

Automated checks include actual SQLite restart/pagination, authenticated transport and relay retry.
Real Bey↔Bey and Bey↔Minibits message/payment tests remain required before declaring interoperability
complete. Follow `docs/testing/nostr-people-checklist.md` for native verification.

## Request lifecycle

Addressed ecash requests are saved as conversation cards before relay publication. A card shows
Sending, Send failed (with retry), or Awaiting payment. Retry reuses the request ID and saved
encrypted events. Generic QR/copy requests remain outside conversations until addressed.

Incoming requests retain their NUT-18 ID. Paying persists a link to the Coco send operation before
delivery. The wallet tracks completion after the payment screen closes and reconciles on startup,
foreground, and relay refresh. Awaiting claim means publication succeeded; Paid requires Coco to
confirm the payment proofs spent. An unresolved operation suppresses Pay; failed encrypted delivery
can be retried from payment details without creating another operation. Reclaimed is separate from Paid.

On the requester side, Received requires a successful claim. Responses waiting for contact acceptance
or mint approval remain waiting. Explicit response IDs never fall back to a different same-amount
request; ID-less legacy responses must have exactly one matching amount, mint, unit, and known payer.
Terminal requests survive reload, and local age alone does not expire a request. Old unlinked
records are not guessed into conversations or marked paid from their amount alone.

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
