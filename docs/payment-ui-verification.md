# Payment UI device acceptance

Automated tests cover currency formatting, local mint selection, confirmation notes,
optional authentication, SDK-prepared creation fees, P2PK refund conditions, and reclaim races.
Native acceptance below has not been performed in this workspace.

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
