# Transaction receipts

History, conversation payment links, payment-request receipts, and notification actions use the
same state-based presentation. Settled and terminal failed transactions open a compact receipt sheet;
pending, unclaimed, unresolved and review-needed transactions open a full screen. The root
`/txn-details` route supports both without changing route identity during an operation;
the older modal route redirects for compatibility. A local bottom-sheet provider keeps receipt
and confirmation portals inside the native modal's window.

Initial loading uses a compact progress indicator over the originating page while local history,
quote details and presentation state resolve. It does not open a temporary full screen or sheet.
The loading indicator can be cancelled when no protected operation is running.
Later detail refreshes keep the chosen presentation mounted. Pending screen headers use the same
16-point content gutters, balanced 48-point navigation slots and symmetric vertical padding as
receipt headers; already-inset receipt content does not receive a second horizontal inset.

Settled receipts fit their content and scroll when needed. Live QR/action layouts keep the full
screen and existing status checks and actions. They stay full screen if settlement occurs while open;
reopening a settled receipt uses the compact sheet. Paid-but-unissued top-ups and unknown states
remain full screen. Transfer presentation follows its overall result. Close and Android Back remain
blocked during claim, reclaim, or invoice redemption; active screens have no sheet swipe/backdrop.
Authentication
and payment submission rules are unchanged. Receipts are masked when locked or when wallet identity
changes; an idle receipt closes so the existing unlock screen remains accessible.

All receipt tables use the soft outlined variant with the shared compact rows and full-width
dividers. Main rows show status, date, mint, confirmed fee when known, description/notes, and the
recipient when retained. On-chain receipts keep addresses and transaction/explorer links. Transfer
receipts name both mints and show the overall outcome. Ecash retains live QR/share/claim/reclaim
controls; settled ecash offers an explicit Copy original token action, without restoring its QR.

Show details starts collapsed and is omitted for an empty field list. It exposes only allowlisted
transaction/operation/quote identifiers, mint URL, invoice, payment/description hashes, expiry,
quote state/amount, and maximum fee when available. A Lightning payment proof is shown only if its
hash matches the saved invoice's payment hash. Fee reserve is labeled Maximum fee, never actual fee.
No raw metadata, Cashu proofs, signing keys, or spendable tokens enter technical details. Individual
copy controls retain the complete value. Technical expansion uses already-loaded local snapshots;
it does not submit, retry, claim, or initiate an extra quote request.

New outgoing Lightning payments retain the original Lightning recipient locally, keyed by wallet,
mint, and quote. This is optional receipt annotation and cannot interrupt payment execution. Older
receipts use whatever their saved quote/history provides; missing recipients, fees, or proofs are
not invented. An invoice's description is display metadata, not payment validation or settlement
evidence. The SDK continues to authorize and execute payments.

The native Cashu.me reference separates essential receipt fields from a technical-details sheet:
[receipt presentation](https://github.com/cashubtc/wallet/blob/main/android/app/src/main/java/com/cashu/me/ui/history/TransactionDetailScreen.kt),
[technical field allowlist](https://github.com/cashubtc/wallet/blob/main/android/app/src/main/java/com/cashu/me/Core/TransactionTechnicalDetails.kt).
Bey uses an inline Show details disclosure and its existing components.

## Manual checks on Android and iOS preview builds

1. Open completed Lightning, ecash, on-chain, and Transfer entries from History. Confirm the list
   remains behind the sheet, the close control is on the left, and Back/backdrop/swipe returns to it.
2. Expand Show details. Check long invoices/hashes wrap, copy returns the full original value, every
   visible row has one separator, and no raw proof inputs, private keys, or spendable token appear.
3. Make a small Lightning-address payment. Compare recipient/description on the result and History
   receipt, then restart and reopen it. A saved, matching payment proof should be copyable; unavailable
   data should remain absent. Use a test mint where possible.
4. Open pending Lightning invoices and ecash requests. Confirm they fill the screen; check QR,
   copy/share, expiration, status refresh, claim, and reclaim. During an operation, attempt Close and
   Android Back: neither should interrupt it. Active screens should have no sheet swipe or backdrop.
   Repeat after a failed operation to confirm closing is released.
5. Settle a pending payment with the full screen open. Confirm it updates without closing or shrinking, and
   reopening it shows the compact settled receipt. Pending/unknown outcomes must never appear successful.
6. Test pending/settled on-chain deposits and withdrawals. Check destination, network, hash copying,
   explorer navigation and offline/unavailable lookups. A maximum fee must not be shown as an actual fee.
7. Open receipts from a conversation, an NFC/request receipt, a warm notification, and a cold-start
   notification after authentication. Check missing/deleted targets and the legacy route's fallback.
8. Background/lock the wallet while a receipt is open; ensure no receipt data remains visible. Unlock
   and reopen it. Verify wallet switching cannot retain a previous wallet's receipt or recipient.
9. Test deletion confirmation without accepting it first. Check cancellation returns to the receipt;
   confirm deletion only for a disposable test entry. Check large text, small screens, VoiceOver/TalkBack,
   reduced motion, and both themes, including scroll and action-footer reachability.

Physical device rendering, native gesture/portal behavior, biometric overlays and real payment
settlement remain unverified locally. Fully closed-app receiving alerts remain unsupported.

## Automated verification

The broader receipt/hybrid regression run passed **173 suites / 1,383 tests**. Two existing baseline suites were
excluded: `header-navigation.test.tsx` lacks the NFC native mock and `mint-url-navigation.test.tsx`
lacks the Tamagui `usePropsAndStyle` mock. Focused classification, presentation, scrolling, reclaim,
and notification-navigation checks passed **5 suites / 65 tests**. The subsequent header/loading fix
passed **5 suites / 52 tests**, covering initial loading, local-detail readiness, safe cancellation
and refresh stability. Another **5 receipt/payment suites / 67 tests** also passed.
Typecheck, the button check, structure check (75 routes), scoped
Prettier and whitespace checks passed. The interaction source inventory was refreshed (1,413 records).
These are automated results, not evidence of physical-device gesture or payment delivery behavior.
