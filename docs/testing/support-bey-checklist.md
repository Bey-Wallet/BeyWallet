# Support Bey device checks

Status: pending device verification. Local tests use mocked payment/native APIs; no funds
were sent during implementation.

- Open Support Bey from Home and Settings. Confirm brief copy, address QR, Copy and Pay now;
  no recurring plans or amount entry appear on the support screen.
- Scan the QR with another Lightning wallet. Confirm the exact recipient is
  `beywallet@blitzwalletapp.com` and that the payer chooses its own amount. Opening Support
  Bey alone must not request an invoice or initiate payment.
- Check the QR and address in both themes, at narrow widths and with larger system text.
  Copy must copy the complete address; failed clipboard access must not display Copied.
- Tap Pay now rapidly. Confirm only one payment flow opens and the native support modal
  closes first on iOS. Test Android hardware back, iOS dismissal, reduced motion, returning
  to Settings after cancelling payment, and reopening support from Home.
- Confirm the melt destination is prefilled correctly and the amount starts at zero.
  Try 1k, 5k and 10k sat presets and custom amounts in sats and fiat modes. Presets always
  represent sats and must not change the saved primary-currency preference.
- Choose a trusted mint. Continue with a small test amount, review recipient and maximum
  fee/total, cancel authentication once, then explicitly confirm a test payment. Check
  recipient receipt, wallet balance and a single history entry. Never pay from Pay now alone.
- Test an amount outside the recipient's live LNURL limits, insufficient balance, offline
  entry, failed address resolution and an expired invoice. Existing payment checks must apply.
- Confirm normal Lightning entry has no support presets and remains editable. Test payment
  from both Home and Settings and reopening Pay now after returning from a cancelled flow.
- Do not show again must hide Home's prompt after restart while Support Bey remains in Settings.
