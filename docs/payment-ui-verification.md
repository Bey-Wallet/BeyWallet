# Payment UI device acceptance

Automated tests cover currency formatting, local mint selection, confirmation notes,
optional authentication, SDK-prepared creation fees, P2PK refund conditions, and reclaim races.
Native acceptance below has not been performed in this workspace.

## Outgoing Lightning receipt lifecycle

Pending or unresolved outgoing Lightning receipts check the original payment while
the receipt is visible, focused, online and foregrounded. Checks resume immediately
on foreground/focus/network return and stop after settlement. Manual and automatic
checks share one in-flight request; they never submit the invoice again. A late
result after the receipt closes does not update its UI, balance or history queries.

On Android, switch apps or lock the phone during a small Lightning payment, then
return and unlock. Confirm that the original receipt updates to its settled state,
History contains one payment and the balance changes once. Repeat with a network
interruption; an unverified outcome must remain pending/unresolved until reconciled.

## Durable outgoing Lightning attempts

The SQLite melt-operation repository writes a minimal History projection in the same
transaction as each operation create/update. One operation ID owns one receipt. Init
cleanup retains a failed receipt; rollback before submission records cancellation;
rollback after execution records failure only after the SDK confirms/reclaims it.
Executing/pending operations remain pending, and incomplete rollback stays unconfirmed.
No proof secrets, output data or signing keys are copied into History. Draft/cancelled
attempts do not display as debits. History status checks reconcile the original operation
without preparing or submitting a replacement payment.

Wallet initialization backfills missing receipts from existing local operations, without
network calls or rewriting receipts already present. Attempts whose operations were deleted
before this feature cannot be reconstructed. Deliberately erased receipts are marked in the
existing encrypted settings table so backfill and later operation updates do not resurrect them.

SQLite integration tests cover lifecycle persistence, failed preparation, cancellation,
confirmed rollback, repeated backfill, legacy quote adoption, deletion and atomic write failure.
Still verify on an Android dev client:

- Open a valid invoice review and go Back: History retains one cancelled attempt, without a debit.
- Trigger a mint/preparation failure: the failed attempt remains visible after reopening.
- Submit a small test payment and interrupt the connection: History retains one pending or
  unconfirmed attempt; reconnect/check status without paying it again.
- Force-close during submission, reopen and confirm reconciliation updates the existing row.
- Delete a terminal receipt, reopen and confirm the deletion is respected.

## Mint quote redemption coordination

The pinned Coco patch coordinates foreground and background redemption by mint and quote.
Concurrent callers share issuance; retries in the same wallet runtime retain their original
outputs. Returned proofs are retained across a failed local save, and a failed quote-state
write does not cause the already saved proofs to be inserted again. Completion is emitted only
after proofs and the issued state are saved. Both the ESM and CommonJS builds carry the patch.

These retry records live in memory, not in a new recovery journal. Process termination still
requires the existing deterministic mint recovery where supported; this change does not add
crash-proof issuance recovery or alter seed derivation. A remote ISSUED state or error 20006
alone is never accepted as proof that this wallet recovered the funds.

Device checks for this change:

- Pay a Lightning top-up while the QR screen is open. Check for one receipt transition and
  an updated, spendable balance; background processing and screen refresh must not compete.
- Refresh repeatedly during issuance. Confirm no duplicate issuance or repeated counter
  allocation for the same in-memory attempt, and no repeated busy-state flicker while unpaid.
- After PAID is observed, delayed issuance must show **Issuing ecash…**. A failed issuance
  must not say the Lightning payment was never received or show successful fund receipt.
- Test both testnut and another compatible mint. Testnut's previously observed 20006 response
  needs live verification; client coordination cannot guarantee the mint's processing speed.
- Interrupt network access and restart the app during issuance, then reconcile/recover through
  the existing recovery flow before retrying a payment. Never pay the invoice twice to repair
  a missing local receipt.

## General device checks

- Send/Receive, mint selection, and NFC use `AppBottomSheet`, with centered headers
  and left close/back controls. Send/Receive use the app background and size for their
  content, with scrolling choices and safe-area bottom padding. Check both themes, large text,
  keyboard resizing, Android Back, backdrop/swipe dismissal, and processing locks.
  Send offers Share ecash and Tap to pay; Receive offers Request ecash and Bitcoin.
  Scan remains on Home.
  Mint selection has no search field. NFC sizes to its scrollable content, with status
  in the header and compact instructions/details; Done closes a confirmed receipt.
  `AppFullScreenModal` remains available for future use.

- In Send/Receive, type and paste `name@domain`, including a Bey domain address and
  `lightning:name@domain`. Each must open Lightning payment review without querying
  Nostr identity data. Nostr identifiers and bare usernames should direct users to
  People. Verify accepted-person sends still work from a conversation.
- Send/Receive use a 96-point bordered input with minimal padding and no leading
  icon. Action labels/descriptions use 16/14-point text. A secondary Paste pill follows
  the action list in the scrolling content, replaced by Continue when text is entered.
  Clear sits inside the field on the right; verify keyboard resizing, long
  payment details, loading/disabled states, and correction of invalid input.
- Paste a complete payment using both the pill and Android's long-press Paste menu.
  Both must process automatically, dismiss the sheet, and open the appropriate payment
  screen once. Native text echoes must not cancel a pending lookup. Single-character
  typing and deletions retain Continue; invalid pasted details stay editable.
- On Android, NFC must show **Starting NFC** during reader registration or sender
  startup, then **Hold phones together** only when ready. Check the distinct reader
  and sender instructions, disabled NFC, a canceled startup, and background/resume.
  Separate phones before delivery: **Retry delivery** must reuse the existing token.
  Reconnect to the same request after an interrupted write; no second payment may be
  created. A delivered token is not a confirmed claim.
- In History, verify created ecash and observed delivery remain visibly pending.
  Completed rows stay minimal without repeated claimed/confirmed labels; pending,
  failed, and refunded rows retain useful status detail. Refresh remains observational. Reclaim stays in
  transaction details with its existing eligibility checks. Match delivery evidence
  by operation ID, including after restarting; never infer delivery from equal amounts.
- On first recovery, offline send/receive confirmation, and mint selection, check
  the short explanations and dismiss controls with large text and screen readers.
  Dismiss each explanation, restart, and verify it stays dismissed without hiding
  required security warnings or changing authentication, mint trust, or payment checks.

- The mint selector uses a rounded ListTable group with full-width separators,
  40-point mint icons, single-line names above primary-currency balances, and selection
  checks on the right. Opening it uses the saved mint list and does
  not trigger a full refresh. Payment-method filtering reads SDK metadata locally;
  trust and allowed-URL restrictions still apply offline. Saved exchange rates are
  available immediately; without a rate, nonzero amounts retain an explicit sat unit.
  The chosen row shows a spinner until selection completes, then a check before
  closing. Failed selection stays open with an error and supports retry.
- On device, open the selector in airplane mode with cached balances and icons.
  Test Home, history's All mints option, and payment-specific selectors. Switch
  repeatedly, tap two rows quickly, and try to dismiss while a selection is pending.
  Confirm smooth scrolling, correct primary/hidden balances, check placement, and
  large-text layouts. Payment selectors must keep the Home mint unchanged.

- Open Send, Receive, and Fund & withdraw. Check single-column Send/Receive cards and
  the existing two-column Fund & withdraw cards in light/dark themes, on a small
  screen, and with large text. Expand the sheet and open the keyboard; every action must
  remain reachable without overlapping content.
- Receive → Ecash must open request creation directly. Paste a token into the sheet input
  and verify that it opens token claiming instead. Check typed input with Continue, Clear,
  an empty/denied clipboard, invalid details, and Lightning/on-chain/Nostr routing.
- Dismiss or swipe away the sheet while a clipboard read or payment lookup is pending.
  No late result may navigate. Reopen it and verify the draft resets and each new action
  navigates once, including after rapid repeated taps.

- In Settings, open **Get change**, select a trusted mint, and review the whole available
  balance, mint fee, and resulting balance. Cancel or change mints and verify that reserved
  coins are released without changing the home mint. Empty balances, unsupported restore,
  and fees consuming the balance must block creation with an explanation.
- Prepare change on a small balance online. Confirm the resulting amount equals the
  reviewed balance minus the fee and History contains no artificial payment pair. Enable
  airplane mode and create several exact small ecash amounts without a mode toggle.
- Interrupt Get change after submission and restart. Reconnect and use Retry in the same
  mint's sheet if recovery is still pending. Verify that the original operation completes
  once, without a second fee or releasing potentially spent inputs. Export/import a wallet
  backup containing an unfinished change operation and verify that it remains recoverable.
- While reviewing a send, switch connectivity off and on and resume the app from the
  background. Offline behavior must follow connectivity automatically. Change connectivity
  during submission and verify that an executing payment is never replaced or restarted.

- Check Lightning and on-chain top-ups/payments, bearer ecash, encrypted links, P2PK,
  locked/unlocked Nostr sends, requests, swaps, NFC, pending payments, and reopened receipts.
- Check a small display and large text in light/dark themes. Confirm that the amount,
  details, QR quiet zone, and bottom action remain usable without overlap.
- Change primary currency and Bitcoin-symbol preferences. Disconnect pricing: conversion
  must be unavailable rather than zero.
- Switch confirmation mints, including one with insufficient balance. Return to amount
  entry, edit the amount, switch back, and dismiss the flow. Check that unused reservations
  are released and the home mint never changes. Issued invoices, addresses, requests,
  and tokens must retain their mint.
- Add, edit, clear, and restore a request note by navigating back. Decode the generated
  request and shared link to verify that its description is unchanged by presentation.
- With biometrics disabled, confirm Lightning payment without an authentication prompt.
  With biometrics enabled, test success, cancellation, failure, and rapid double taps.
- Scan QR codes and use native copy/share for complete invoices, addresses, tokens,
  requests, and links. Check expired invoices and pending/unconfirmed receipts.
- Verify NFC reading, sending, request payment, cancellation, refresh, and delivery retry.
- In airplane mode, create standard ecash for an amount that the available coins can
  compose exactly. Continue must open confirmation directly, show a zero creation fee,
  and create exactly that amount without a denomination or nearby-value selector.
  Confirm only one pending History entry exists, including after restarting the app.
- While still offline, enter an amount the coins cannot compose. Creation must stay
  disabled and ask to go online for change; it must not round the amount or alter signed
  proof denominations. Reconnect and verify claim checking and reclaim of an unclaimed
  offline token. Online mint operations now prepare a mix of smaller change coins;
  existing large coins still require an online operation before they can be split.
- With an exact local coin match, create ordinary ecash while connected to a slow or
  unreachable mint. Review and creation must work locally with zero creation fees.
  Cancel a review and confirm its reserved coins become available again. After an online
  receive or swap produces change, enable airplane mode and create several exact small
  amounts. Check that claimed local sends update History after reconnecting, including
  after restarting the app. Preparing smaller coins can increase later input fees.
- From People and a conversation, pay an accepted person with P2PK enabled, both with
  reclaim off and with a future reclaim deadline. Confirm the creation fee is shown and
  the recipient can claim the token. Back out before sending and verify reservations release.
- In standard ecash confirmation, enable the P2PK card above the details. Type, paste,
  and scan valid compressed/uncompressed/x-only hex keys, npubs, and nprofiles. Confirm
  invalid keys block saving, canceling a key edit preserves the saved key, and returning
  from the scanner reopens the draft sheet. Change the key or turn locking off and verify
  the creation fee refreshes. Test going offline with locking enabled: no bearer token
  may be created. Share a small locked token and verify only its intended recipient can claim it.
- Pay a new Minibits Nostr request with **Exact amount for legacy wallets** enabled.
  Confirm the review shows the recipient's amount after receiving fees and Minibits accepts
  the requested face value. The option defaults off, is unavailable for automatic NFC payments,
  and locks when delivery starts. Default payments continue covering the receiver's input fees.
- Interrupt legacy request delivery and retry or reopen it. Verify the same encrypted
  payment is retried and only one send operation exists. An older rejected payment must be
  resolved or reclaimed in History; enabling compatibility cannot replace its existing token.
- On a mint advertising NUT-11, inspect a locked token's `locktime` and public `refund`
  conditions for every reclaim preset. Before eligibility the sender cannot refund;
  afterward verify receipt through the sender's existing signing identity. The recipient
  may still win the spending race. Never mark failed or ambiguous receipt as reclaimed.
- Verify that reclaim is absent for bearer/link/offline/unsupported/unknown-capability
  sends and is cleared when a method/mint becomes incompatible. Check legacy local expiry.
- Verify automatic reclaim while active and unlocked, and no automatic reclaim while
  backgrounded or locked. Eligibility is not a guaranteed background refund.
- Complete live Lightning and on-chain flows; verify maximum fee labels at review,
  actual fees only on receipts, stable event times, and broadcast versus settled status.

Reclaim adds a sender refund spending path; it does not invalidate recipient signatures
at the deadline. See [Cashu NUT-11](https://github.com/cashubtc/nuts/blob/main/11.md).

## Lightning invoice preparation in the action sheet

- Paste a fixed-amount BOLT11 invoice into Send. The action sheet replaces its input
  and choices with the existing spinner and a compact preparing state, then opens
  confirmation directly. No second input screen or second quote request should appear.
- Confirm the paying mint, amount, maximum fee and total, then tap Pay and authenticate.
  Preparing the invoice must never submit a payment automatically.
- Try an offline, expired or unreachable-mint invoice. The sheet must retain the input
  and show an error so it can be edited or retried.
- Background the app during preparation, then return. It must not open confirmation
  from a stale response; the unsubmitted operation must release through existing cleanup.
- On confirmation, change the mint and check that the original preparation releases
  before the replacement quote is used. Cancel and verify the funds remain available.

## Approved payment layout: ecash send

- Standard, locked/P2PK and Nostr sends share compact confirmation amounts, paying
  mint, creation fee and total. An unavailable fee must never appear as zero.
- During submission, the header says Processing payment and the bottom button shows
  only the existing centered spinner. Its loading label remains available to screen readers.
  Editing, dismissal and duplicate submission
  stay blocked by the existing flow guards.
- A created or published token remains unclaimed: keep its QR, Copy/share/NFC controls
  and pending state. Copy is the only bottom action; the header closes the screen.
  Show the creation fee, including known zero fees; unknown fees stay unavailable.
  Operation IDs and full mint URLs use the technical-details sheet's Copy and Share actions.
- Confirm an actual recipient claim before showing Ecash claimed. A failure result
  must not invent a fee paid or offer an automatic second payment.
- For Cashu requests, check manual delivery, relay failure/retry, awaiting recipient
  and unconfirmed receipt. Check status observes the existing payment; retry delivery
  keeps the existing guarded delivery method and cannot replace its operation.
- Device checks: a small standard send and claim, a locked token, a Nostr send, an
  exact offline send, and interrupted request delivery. Verify balances and History
  after closing or backgrounding each flow.

All planned payment layout passes are implemented; native acceptance checks remain.

## POS checkout layout

- Preserve the light POS palette, with filled grouped details using its existing surface
  color. Headers use the compact app header. Payment methods use a small filled pill for
  the selected method and plain text for the inactive method, with stable accessible targets.
- Amount entry keeps the same keypad, amount sizes, fiat minor-unit conversion and note
  behavior. Compact mint/note rows replace the larger mint card in POS only. Keypad spacing
  and bottom padding are reduced without shrinking its keys or changing regular wallet input.
- Ecash and Lightning checkout keep one QR, Amount first below it, applicable note/status
  details and a Copy action. Remove repeated scan instructions and the truncated invoice
  row in POS; full invoice copying/sharing remains available. Preparation/receipt progress
  uses a loader-only footer rather than a large standalone spinner.
- Both POS QR frames blend into the green POS canvas, with black modules and no border.
  Keep the 20-point quiet margin, responsive sizing and 240-point code cap. Regular wallet
  QRs retain their white scan surface and existing border.
- Success uses the shared status icon without an extra circle, compact title/amount,
  grouped mint/note details and the standard Next sale button. Keep both receivers mounted
  while switching methods; only verified receipt evidence completes the frozen sale.
- Device checks: enter sats and fiat, add a note, switch methods and pay either the current
  or previously displayed request. Test QR scanning of both green codes from another phone,
  NFC receipt, offline preparation/retry, delayed Lightning issuance and Next sale. Check a
  small display and large text, and ensure regular wallet screens retain their layouts.

## NFC sheet layout

- Keep NFC startup, tapping, delivery and settlement in the existing compact sheet.
  Active progress moves into the header and a single loader-only primary action; there
  is no large progress spinner above the amount. Retain instructions to keep phones
  together. Pending and unconfirmed outcomes use a static pending indicator.
- Amounts use the shared compact prominent style. One details group contains status,
  mint, NFC method, saved event time and applicable fees/errors. A pay reserve is labelled
  Maximum fee, not Fee paid; actual fees unavailable to the presentation remain unavailable.
- Retry/refresh controls stay small and secondary when a primary Done action is present.
  Keep at least 48-point touch targets. Done closes confirmed or unresolved receipts;
  processing remains locked by the controller. Remove the extra View History action.
- New-payment recovery remains guarded by the existing controller and warns that the
  previous payment may still complete. Preserve same-token delivery retry and existing
  Lightning retry eligibility; no NFC protocol or payment execution code is changed.
- Device checks: startup/ready, successful ecash send/receive, Numo request and Lightning
  tap, interrupted delivery/retry, pending/unconfirmed settlement, disabled NFC, locked
  dismissal and background/resume. Check compact layout, both themes and large text.

## Mint-to-mint Transfer layout

- Review stays on the existing confirmation screen. Its compact amount, source/target mint
  rows, maximum fee and maximum total use the approved payment layout. Preparation and
  submission use a locked loader-only footer action, with status in the header.
- Results show a primary Done action and grouped source/target, status, timestamp and fee
  details. Only saved timestamps are shown. Known actual fees (including zero) replace the
  reserve; unavailable actual fees are never inferred from the reviewed maximum fee.
- Pending receipts distinguish source payment, destination issuance and conflicting
  settlement evidence. Check status is a small action above details, shares an in-flight
  lock and catches network failures without changing pending into failed. Offline checking
  is disabled. Existing service guards control recovery and eligibility for a new attempt.
- Live and History receipts share technical details built from the public transfer journal
  and the two original local quotes. Groups contain Transfer ID/state/stage, source/destination
  mint URLs, operation/quote references, fee reserve, recorded actual fee/total and expiry.
  Source/destination quote groups include saved states, amounts, requests and expiry; a
  source payment proof is exported only if it matches the invoice hash. No keys, proof
  inputs or arbitrary metadata are exported. Opening details never submits a payment.
- Device checks: transfer a small amount between two trusted compatible mints and compare
  live/History receipts; copy/share technical details; test zero/unknown fees, delayed
  destination issuance, offline/reconnect and background/resume. Verify no duplicate payment
  after repeated checks, conflicting evidence remains pending, and review cancellation
  releases reservations through the existing service cleanup.

## On-chain send/receive layout

- Preparing an address/quote and submitting a send use the shared receipt hierarchy:
  status in the header, compact amount when known, grouped details and a locked loader-only
  button. Existing quote creation and submission steps remain unchanged.
- Review retains fee-option selection, mint selection and existing balance/expiry checks.
  Destination copying uses the full address. Maximum fees/totals are labelled as estimates
  and missing fee data remains unavailable; fee reserves never become actual fees paid.
- Pending deposits retain the Bitcoin QR and Amount first below it when known. Pending
  withdrawals retain a receipt without a QR, with a small Check status action and primary
  Done. Copying the destination retains the full value. Status checks never resubmit a send.
- Live pending/terminal flows expose the shared technical sheet. Exports add public network,
  address, quote reserve and observed paid/issued totals where available. A mint-reported
  outpoint may supply a transaction ID; blockchain confirmations remain explicitly unverified.
  Signing keys, proof inputs and change outputs are never added to the receipt model.
- Successful sends say Payment sent, without claiming blockchain confirmation. Actual fees
  remain unavailable unless recorded. Error results close with Done rather than offering an
  immediate new payment. Reconcile the original payment from History before retrying.
- Device checks: create and copy/scan an address, receive and collect a small deposit, pay
  with each offered fee option, and compare the live receipt with History. Test pending,
  failed, offline/reconnect and background/resume states, long addresses, technical-detail
  Copy/Share, light/dark themes and large text. Verify balance changes only after existing
  proof reconciliation, and distinguish mint settlement from blockchain confirmation.

## Lightning receive/top-up layout

- Keep the existing confirmation, invoice and result layouts. Payment detection updates
  the invoice's status to Issuing ecash without inserting a separate processing screen.
  The result appears only after the existing redemption confirms local proof persistence.
- Incomplete issuance remains on the invoice screen. Refresh status retries the original
  quote through the existing redemption guard, including after a known-paid quote expires.
- Saved paid top-ups retain their existing awaiting-ecash layout and menu collection action.
  Offline collection remains disabled. Unpaid QR layouts retain Amount first in details.
- Device checks: pay an unpaid invoice, wait for issuance and confirm one balance credit;
  delay/fail issuance and retry the original quote, including after expiry and from History.
  Test offline/reconnect, background/return, cancellation, expired invoices, conversation
  requests, both themes, large text and invoice QR scanning. Verify POS remains unchanged.

## Ecash receive layout

- Review retains proof-state checks, mint trust consent, recipient locks and offline saving.
  The compact amount sits above the existing details. Estimated fees include known zero;
  failed or offline estimates remain unavailable rather than implying a free claim.
- Claiming and saving replace review with a locked receipt layout: status in the header,
  amount above details and a disabled Receiving/Saving button with the existing spinner.
  There is no second loader or actionable retry during the operation.
- Received, awaiting-claim and failed results share the payment hierarchy and primary Done
  action. Claim/retry is a small explicit action above details. Offline saving never shows
  a completed claim or a credited balance.
- A matching saved receive receipt supplies the timestamp, recorded fee and technical
  details. Unknown fees remain unavailable; opening a result does not invent a timestamp.
- Device checks: receive a small bearer token and a token locked to this wallet; inspect
  an already-spent token; save offline and claim after reconnecting. Interrupt a receive,
  background/return and verify the existing operation guards and History reconciliation.
  Check both themes, large text, copyable notes and technical-detail Copy/Share actions.

## Pending QR amount placement

- Pending ecash, live/saved Lightning invoices, known on-chain deposits, and POS
  ecash/Lightning requests put Amount first in their details list, below the QR.
  The primary value is right-aligned in the primary text color; its secondary
  equivalent follows in parentheses using muted text. Currency ordering follows
  Settings. A missing exchange rate must not become a zero fiat equivalent.
- Unknown deposit amounts retain their existing amount-free state. Outgoing
  on-chain receipts without a QR retain their receipt amount presentation.
- Normal wallet QR codes cap at 240 points, retaining the 20-point white quiet margin.
  POS QR surfaces match the full details-list width, with a 20-point green quiet margin
  and responsive sizing on narrow screens. Check scanning a Lightning invoice,
  static ecash and animated ecash on a phone, plus both POS payment methods.

## POS history checks

- Start fresh POS sales after reloading. Complete one through Ecash and another through
  Lightning. Both must appear in the default transaction list as POS received with their
  method. The POS toggle narrows the list; toggling it off restores all activity.
- A new sale shares one persisted sale ID across its request and invoice. Only the paid
  method remains in the list after receipt. If both methods actually receive funds,
  both payment records remain visible. No balance or payment records are deleted.
- Older sales without a saved sale ID cannot safely combine their separate Lightning
  and Ecash offers. Their known POS payments still appear in the default list.
- Check the larger POS entry amount on a narrow phone, including long fiat and sat
  amounts, large system text and the on-screen keypad. Normal wallet entry stays unchanged.

## Grouped technical details

- Technical details is a header action-menu item, never a receipt-body button or
  inline disclosure. Check live and saved Lightning, Ecash, on-chain and Transfer
  receipts, pending invoices/tokens, payment requests and wallet activity. Existing
  share/delete/refresh actions must remain in the same dropdown. Empty/processing
  states must not show an unusable details action.
- Select Technical details, return with Back, then reopen it. Verify Copy and Share
  retain complete public references, and opening another payment cannot reopen the
  previous payment's sheet. Check this on Android in full-screen and sheet flows.

- Open technical details from a live Lightning result, newly created ecash, a Cashu
  request payment, and the same saved History entry. All use the shared receipt builder:
  Transaction, Quote, Payment, and Request sections appear only when applicable.
- Transaction facts include real History/operation IDs, method, direction, saved
  status, date, amount, known fee, and full mint URL. Quote facts show the local quote's
  state, amount, reserve, mint swap fee, request and expiry where available. Quote state
  and operation state remain separate. Never infer a paid fee from a reserve.
- Reads use exact mint/type/operation-or-quote references and safe SQL columns. Opening
  details never fetches a new quote or payment, and local reads work while offline.
  Missing IDs/dates are not fabricated; missing fee or quote data remains unavailable.
- Copy and Share sit side by side as equal secondary actions. Their text includes section
  headings, complete reference values and UTC timestamps, even when the on-screen value
  is shortened or localized. Row copying retains complete values.
- Exports exclude bearer tokens, proof secrets, change outputs and signing keys.
  Lightning payment proofs still require matching the invoice payment hash. Actual
  settlement fees or proofs absent from saved data are not reconstructed or invented.
- Device checks: compare the same payment in result and History, copy/share details,
  return with the header back button, and repeat in airplane mode. Verify no invoice/token
  contents enter logs.
