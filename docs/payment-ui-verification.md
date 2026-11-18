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
