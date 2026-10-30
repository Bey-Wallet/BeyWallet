# Product polish: one improvement at a time

Keep the accepted Home layout. Add one feature at a time and review its behavior before moving
to the next. Mints and payment-screen redesigns are outside this rollout.
Use the shared `feat/product-polish` branch and a separate focused commit for each improvement.

## 1. History search

Implementation:

- Search opens from an icon beside Filters in the History header. The full-width bar is hidden
  until requested and focuses when opened. Closing search clears its query.
- Match saved contact names/usernames, receipt notes and token memos, satoshi amounts, mint names,
  payment types/statuses, and local calendar dates.
- Examples: `Alice coffee`, `1,000 sat`, `₿1,000`, `Oct 24`, or `2026-10-24`.
- All query terms must match. Numeric terms match complete numbers rather than numeric substrings.
- Search combines with existing quick, mint, date, and payment-type filters. Clearing just the
  query preserves those filters; Reset clears both.
- Recent History keeps its existing 200-entry load. While searching, a separate local query reads
  all persisted payments and wallet activity through the existing service and SQLite repositories.
  Its cache key contains no search text and is invalidated by the existing History events.
- Search text is indexed once per data/contact/mint update. Raw tokens and arbitrary metadata
  are not searchable; existing note extraction supplies public token memos.
- Loading and failure states prevent unavailable history from looking like an empty search.
- No mint/relay requests, payment execution, database schema changes, or new dependencies.

Device review still needed: header placement and keyboard focus, list scrolling while searching,
large histories, large text, and light/dark themes.

Validation: 33 focused tests passed across search matching, header controls, History interactions,
existing filters/notes, and a SQLite integration case finding an entry beyond the recent 200.
Type checking, the structure check, scoped formatting, and diff whitespace checks passed.

## 2. Responsiveness: shared accessibility subscription

The shared reduced-motion hook previously installed a native listener and read the device
preference for each consumer. Buttons, pressables, switches, and spinners all use this hook.
A synthetic test mounting 100 consumers reproduced 100 native subscriptions before the fix.

The hook now uses one shared native subscription and preference read while consumers are mounted.
It retains the safe initial reduced-motion state, propagates live preference changes, ignores
stale reads/events after teardown, and removes the native subscription after the last unmount.
Unchanged preference events do not re-render consumers. Existing control styling is preserved.

Local regression coverage includes subscription sharing, cleanup, live changes, failed reads,
stale callbacks, and repeated events. The 100-consumer fixture now checks one native subscription
and read. This is evidence of less native setup work, not a measurement of app tap latency.
Validation: all 40 focused hook/control tests, type checking, the button check, scoped formatting,
and diff whitespace checks passed.

No Android device was attached during this change. Follow the existing
[restored-wallet performance plan](plans/restored-wallet-performance.md) to compare actual fresh
and restored wallets. Device responsiveness remains unverified.

## 3. Clearer receiving and address sharing

- Receive now includes a direct My addresses entry alongside Request ecash and Bitcoin.
- Keep the Ecash-first default, as requested, and explicit Lightning deep links.
- Explain that the Ecash QR is a Nostr identity for compatible wallets and that the Lightning
  address uses npub.cash. Label the raw Nostr public key and make username copying discoverable.
- Add Create payment request on Ecash and Create Lightning invoice on Lightning. These open
  existing flows; their validation, quote creation, and confirmation behavior is preserved.
- Separate Lightning preference loading from setup. The QR, Copy, and Share remain unavailable
  until the existing readiness conditions are satisfied.
- Keep pending incoming payments reachable when Lightning is disabled, and provide a direct
  management link when enabled. Collection remains in the existing authenticated flow.
- Preserve exact Ecash and Lightning QR, clipboard, and share payloads; no receiving service,
  key derivation, address provider, or automatic-collection policy is changed.

Device review still needed: small screens and large text, QR scanning in compatible wallets,
native clipboard/share sheets, and return navigation from request/invoice setup.

Validation: all 50 focused address/profile, action-selector, Lightning-service, and lifecycle
tests passed, along with type checking, the button check, scoped formatting, and diff whitespace.

Minimal-layout follow-up: keep My addresses as the header title, with Ecash/Lightning tabs directly
below. Use a single receiving identity, prominent QR, compact copy row, and one request/invoice
button. Long public values truncate visually while copying and sharing their full payloads.
Share stays in the header. Lightning management and pending-payment navigation share one compact
group. Remove repeated helper paragraphs and standalone status text; detailed controls remain in
the existing settings destinations. Ecash stays first.
Layout validation: 11 profile/QR/copy/share/navigation tests passed, plus type checking, button,
formatting, and whitespace checks. Native appearance still requires device review.

## 4. Offline readiness and nearby amounts

Standard unlocked ecash confirmation now shows whether the selected amount can be made from
available local coins while offline. When it cannot, offer the nearest payable lower
and higher amounts, omitting a side when none exists. These are combinations of existing signed
coins, never rounded or manufactured change. Respect the current Bitcoin-symbol preference.

Layout follow-up: retain the exact-amount title, with large red Lower and blue Higher options
side by side, as requested. Each option places a small label above its larger amount. Use local
semantic theme colors and readable foregrounds in both appearances. Keep Prepare change small
and background-free below the options; remove the repeated explanatory paragraphs.
Online confirmation hides this entire section and skips the advisory denomination check; the
existing mint-backed preparation can create the exact amount. Reconnecting hides old suggestions
immediately while the online review is prepared.

Selecting an alternative changes the review amount and rechecks availability; it does not create
ecash. Creation still requires a separate confirmation and the existing execution checks. Online
reviews are released before replacements. Locked payments retain their online requirement.

Prepare change opens the existing review flow for the selected trusted mint, without changing
the global mint. Release the current send review first, including one still being prepared;
block navigation if release fails. Offline users are told to reconnect. No automatic swaps,
proof-state changes, or changes to payment execution or recovery are introduced by the readiness
display. Suggestions are advisory and do not reserve coins.

Validation: 39 initial selection, send-review, and Prepare change tests passed. A further run
passed all 53 confirmation, send-review, offline-creation, offline-change, and change-preparation
tests, including both replacement choices, stale availability, in-flight review disposal, and
failed-release navigation blocking. Type checking, the button check, scoped formatting, and diff
whitespace checks passed.

Binary denominations use greedy lower selection and complementary upper selection without
scanning possible amounts. Non-binary inventories use bounded subset enumeration; if it cannot
complete safely, no approximate suggestions are shown.

Device review still needed: small screens, large text, light/dark themes, going offline during
review, and returning from Prepare change. Native payment and connectivity behavior remains
unverified locally.

## 5. Actionable pending payment receipts

- Paid Lightning top-ups show Payment received / Awaiting ecash and a Collect ecash action,
  without a payable QR, expiry countdown, or Cancel action. Unpaid invoices retain their QR and
  keep their status-row refresh. Offline collection/check controls are disabled.
- Paid top-ups without a saved invoice also offer collection in the normal receipt. This uses
  the existing quote-redemption method; no second invoice or replacement payment is created.
- Pending ecash and on-chain receipts retain their existing status-row refresh. Remove the
  added helper paragraphs and duplicate Check buttons, as requested. Checks/reclaim remain
  disabled offline. Incoming ecash keeps its existing Claim action.
- Normal pending receipts now use the existing observational status checker rather than only
  refetching saved history. Show its latest response or a clear verification failure. A failed
  check does not mark the payment failed or initiate a retry.
- Pending outgoing ecash rows use Awaiting claim below Ecash created / Ecash delivered, instead
  of repeating Ecash and Created/Delivered in the subtitle. Delivery remains separate from claim.
- Existing background top-up redemption remains in place. A shared guard prevents overlapping
  background/manual redemption and duplicate collection taps. Existing token verification,
  reclaim, expiry handling, and payment services retain their validations.

Validation: 87 focused tests passed across top-up presentation, receipt interactions, status
checking, reclaim, on-chain presentation, animated token QR, receipt details, and receipt sheets.
Type checking, the button check, scoped formatting, and diff whitespace checks passed.
Device review remains: paid/unpaid top-ups with a real mint, connectivity changes, native receipt
layout, and actual claim/reclaim/Bitcoin settlement. Local checks mock network and native APIs.

## 6. Unified point of sale

Access: Home → Receive → Point of sale. Use the regular full-screen modal and native payment
header; keep Home's main actions and mint selector unchanged. Enter an amount using the existing
currency-aware keypad and optionally add a note in place of the amount presets. Charge freezes
the amount, mint, and note for one sale.

The checkout follows [NUMO's receiving pattern](https://github.com/cashubtc/Numo#how-it-works):
Ecash and Lightning tabs share one sale. Ecash creates a saved NUT-18 request through the existing
request screen and retains its current NFC advertisement, receipt matching, and review controls.
The first Lightning selection creates one saved invoice. Switching away and back reuses it.
Keep both receivers listening after switching: a verified payment to the previously displayed
method can complete the sale. Pause Ecash NFC advertisement while Lightning is selected.

Success requires the existing verified Ecash receipt/request outcome or the matching mint/quote
redemption. A read, delivery, invoice creation, or paid-but-unissued quote does not trigger
success. Show one confirmation and Next sale, which clears the amount/note and preserves the
locally selected mint. Late additional receipts remain in normal wallet History; closing the
checkout does not falsely mark an unpaid invoice failed or cancel its saved request.

Cashu notes use the request description. Coco's current quote-creation API has no description
argument, so supported Lightning notes use cashu-ts invoice creation followed by registration
through Coco's existing quote API for persistence, watchers, and issuance. Check mint trust and
confirm that the quote was saved before showing it. Unsupported descriptions silently use the
normal Coco invoice path, as requested. Do not alter invoice strings after signing. Other
invoice creation without a note retains its existing path. Remove the redundant Pay with
Lightning caption above live and History invoice QR codes.

Lightning NFC advertisement is deferred at the user's request. This release provides Lightning
QR/copy and the existing Ecash NFC path. No auto-withdrawals, inventory, or new dependencies.

Validation: 77 focused tests passed for merchant setup, method retention and late confirmation,
next-sale reset, trusted-mint/amount guards, duplicate redemption, failed creation, receiving
verification, Receive routing, note support/fallback and saved-quote handling, and existing
request/invoice/receipt UI. Native layout, keyboard behavior, Ecash NFC, and real supported/
unsupported-mint invoice descriptions still require device testing. Network/native APIs are
mocked in local tests.
Type checking, the structure check (76 Expo routes), button check, scoped formatting, and diff
whitespace checks passed. The receiving suite also verifies that switching away pauses Ecash NFC.

## 7. Android launcher shortcuts

Long-press the installed Android app icon to open Scan or Receive. Scan opens the existing
scanner with its normal receive return path; Receive opens the existing Send/Receive bottom
sheet in Receive mode. Its contents mount only when first requested. Home is unchanged.

The Expo plugin writes static shortcut resources, icons, and a small forwarding activity on
prebuild. That activity keeps launcher CLEAR_TASK flags out of the existing wallet task and
accepts only the two exact public action URLs. No tokens, amounts, recipient data, arbitrary
destinations, or extra intent payloads are forwarded.

Cold launches queue until wallet startup and unlock; warm launches preserve the active route
until the shortcut can run. Wait during recovery, backgrounding, native sessions, and active
wallet operations. Keep only the latest pending action and consume it once. The existing NFC
intent handler remains the fallback for non-shortcut URLs. Add observable subscriptions to the
existing navigation guard without changing its blocking behavior.

Android is first, as requested; no iOS quick actions or dependencies were added. A native rebuild
and installation are required: Metro/OTA alone cannot add launcher resources. The local generated
Android project is ignored by Git; the committed Expo plugin reproduces these registrations.

Validation: 49 focused shortcut, Android registration, existing NFC, and notification navigation
tests passed. Coverage includes delayed authentication, busy/recovery/native-session/background
deferral, repeat intents, exact action allowlisting, XML parsing, and reproducible generation.
Type checking, the structure/button checks, scoped formatting, and diff whitespace checks passed.
No Android device was attached. Verify launcher appearance, cold/warm shortcuts, unlock and
camera permissions, and interruption of an active wallet operation after installing a rebuilt app.
Native validation reached resource linking but the existing app theme references the unavailable
`Theme.Material3Expressive.DayNight.NoActionBar` resource. Android compilation therefore remains
unverified. The initial offline attempt also lacked cached Glide artifacts; normal resolution
got past that blocker without changing dependency versions. No unrelated theme/dependency fixes
are included in the shortcut commit.

## Remaining queue

1. Verify responsiveness on fresh and restored wallets using the existing device measurement plan.
2. Improve empty states with useful next actions.
3. Offer shareable receipt images containing an appropriate public payment summary.
4. Show understandable backup status in Settings.
5. Add Lightning invoice NFC advertisement after the POS review.
6. Add iOS app-icon quick actions when iOS is in scope.

Each item needs its own scope review and focused checks. Device-dependent behavior and service
requirements must be verified during that item's implementation; this document does not mark
the queued work implemented.
