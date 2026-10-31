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

## 8. Useful empty states

- Empty History offers Receive through the existing bottom sheet. Filtered/search results keep
  Reset, and loading/failure states retain their existing feedback.
- Empty People search offers Clear search and returns focus to the field. Keep Find someone
  accessible with the normal button touch target. Failed or loading searches no longer also
  show No people found.
- Empty connected/discovered mint lists offer Enter mint URL, or Clear search when filtered.
  Enter mint URL scrolls to and focuses the existing input. Use compact text and the shared
  neutral empty-state surface; connected rows and Home's mint selector stay unchanged.

Validation: 39 focused History, People model/row, and mint navigation tests passed, including
Receive opening and clearing unmatched mint searches without changing wallet mints. Type
checking, the button check, scoped formatting, and diff whitespace checks passed. The People
tests emit existing native SQLite mock warnings. Device review remains for keyboard focus,
small screens, large text, light/dark themes, and the Receive sheet.

## 9. POS entry and pending-payment listening

POS keeps the existing mint selector and replaces Available balance with an editable Note row.
The amount card expands into the remaining space above the keypad. Regular minting keeps its
balance and presets. Empty request QR placeholders use the neutral theme surface; actual QR
codes retain their white quiet zone and black modules.

Keep event-based payment listeners and use a shared visible-screen fallback: check immediately,
then wait 2 seconds after each completed check. Pause offline, in the background, on navigation
blur, and after settlement. Previously, History checked every 3 seconds, live ecash sends every
2.5 seconds, and Bitcoin deposits every 10 seconds. Nostr request reconciliation remains
event-driven with its global 30-second fallback, supplemented by visible-screen reconciliation.
The wallet's existing mint watcher and 5-second quote processor remain in place.

Lightning checks read quote status before collection; only PAID invokes existing redemption.
Unpaid checks do not reserve outputs or attempt issuance. Preserve proof verification, existing
expiry/reclaim behavior, operation guards, and authenticated wallet flows. Background observations
stay silent. The status row shows one continuous listening spinner and stable text; completed,
expired, paused, and offline states do not claim to be actively listening. Respect reduced motion.

Both POS methods stop their screen-level checks after either verified payment completes a sale.
Retain listening across method switches before completion. This prevents the hidden Lightning
receiver from toggling busy every 2 seconds and making Next sale blink. In-flight operations
still finish under the existing navigation guard.

Fix the Lightning note path: cashu-ts ignores constructor-only mintInfo without a full cache,
so the former Wallet.getMintInfo call failed before creating an invoice. Read capabilities with
MintInfo and create the public invoice with the validated Mint API, then save it through Coco.
Preserve trusted-mint validation, silent omission of unsupported descriptions, and persistence
checks before displaying the invoice. Tests use the installed MintInfo implementation.

Validation: 179 tests passed across 17 focused suites, including polling cleanup/resume, slow
requests, duplicate-check guards, unpaid/expired invoices, post-sale shutdown, single-spinner
presentation, note creation/fallback, POS entry, and existing claim/reclaim/offline safeguards.
Type checking, structure/button checks, scoped formatting, and whitespace checks passed.
Device review remains for POS sizing/keyboard, QR scanning, actual supported/unsupported-mint
invoice creation, NFC, and real payment timing. Testnut's public info currently advertises notes
and simulated paid invoices; it cannot demonstrate the timing of a real Lightning payment.

## 10. Shareable receipt images

History receipts, live Lightning invoices and saved Ecash requests offer Share receipt image.
Preview a dedicated public-summary SVG before exporting a high-resolution PNG through the
existing native share sheet. No screen capture, new dependency, or wallet operation is involved.
The image uses a logo-only Bey header, the active light/dark theme, a Payment summary label,
primary and secondary currencies in the selected order, payment type, direction, date, and public mint
name/origin. Status lives in the detail rows; non-pending outcomes also get a large icon beside
the amount. A small centered, muted footer says Download Bey Wallet @ bey.cash on the existing background.
Missing price data is labelled unavailable; no fiat value is invented.

Pending images explicitly say Pending and Payment not confirmed. Payable public QRs appear at
the top-left for pending saved Ecash requests and unpaid Lightning invoices. Paid, expired or
completed invoices do not export a payable QR. Keep the four-module quiet zone, black modules
and white scan area in either theme. Spendable token QRs, proofs, wallet identifiers, contacts,
private keys, and arbitrary metadata stay outside the image boundary. Public request QRs retain
the exact payment routing/description payload the user chose to share. Text mint URLs omit
credentials, query parameters, fragments and private paths.

Native sharing preserves the existing auto-lock state, guards repeat taps and surfaces render/
sharing failures. PNGs are written to the app cache. Device testing remains for PNG fonts,
native share destinations, narrow/large-text previews and scanning exported request/invoice QRs.
Local coverage checks the public field allowlist, pending/paid/expired distinctions, token QR
exclusion, URL sanitization, both currency orders, unavailable conversion, dark theme, top-left
QR placement, PNG export and lock restoration, alongside existing receipt/request behavior.

## 11. Backup status in Settings

Settings → Backup & recovery → Backup status shows three compact, read-only rows: recovery
phrase confirmation, wallet-file export, and the last successful mint-list publication. Existing
protected phrase/export screens and mint-backup management stay one tap away. Home is unchanged.

Record phrase confirmation time after the existing settings write succeeds, and file-export
time after a successful direct write or completed share sheet. Android direct writes display
Saved. Share-sheet exports display Save not verified because the destination save/cancellation
cannot be confirmed. Failed writes do not advance the last-success time. Legacy confirmations
without a timestamp say Date not recorded; missing exports/publications say Not recorded.

Explain what each backup contains: wallet files hold the phrase, ecash, mints and wallet history
at export time; published mint-list backups contain mint URLs only. Store only timestamps and
the save-method enum, with validation when rehydrating. Clear these wallet-scoped records and
the old phrase-confirmation flag when destroying/replacing a wallet. Existing authentication,
backup contents, restore confirmation, seed derivation and wallet recovery operations retain
their existing behavior.

Combined validation for receipts and backup status: all 88 tests passed across 12 focused suites.
Type checking, the route structure check (77 routes), button check, scoped formatting and diff
whitespace checks passed. Native image rendering/QR scanning, file permissions, share/save
destinations, and Settings appearance still require device review.

## Remaining queue

1. Verify responsiveness on fresh and restored wallets using the existing device measurement plan.
2. Add Lightning invoice NFC advertisement after the POS review.
3. Add iOS app-icon quick actions when iOS is in scope.

Each item needs its own scope review and focused checks. Device-dependent behavior and service
requirements must be verified during that item's implementation; this document does not mark
the queued work implemented.
