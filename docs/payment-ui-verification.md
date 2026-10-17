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
