# Async feedback checks

The audited screens reuse AppButton loading states, Spinner, SettingsMessage,
neutral grouped surfaces, and existing receipt status rows. Empty messages appear
after a successful read, rather than while data is loading or unavailable.

## Automated regression coverage

- Receiving mint: initial loading, a genuinely empty list, failed reads, retry, and
  trusted-only results. Payment collection shows loading on the active action and
  releases its controls after failure.
- Optimization Settings: loading and failure do not claim an optimal wallet;
  retry reloads both proofs and analysis.
- Search directory: pending, HTTP and malformed-response failures, retry, and
  preservation of saved results after a failed refresh.
- Transaction receipt: a failed read offers retry instead of claiming the record
  is missing.
- Transfer receipt: failed verification remains pending, explains that the check
  failed, and does not offer a replacement payment action.
- Nostr activity: sent history distinguishes loading, failure, and a genuinely
  empty list, with retry for failed reads.

## Device checks

- In both themes, check the receiving-mint picker on a clean wallet and a wallet
  with trusted mints. Loading/error panels must not overlap controls.
- Check payments and collect one/all pending Lightning payments on a slow
  connection. Only the action being performed should show a loading label.
- Open both optimization routes on a mint with no proofs and with several proofs.
  Switch mints and retry a failed read; no old optimal state should flash.
- Open Nostr activity, token details, and transaction receipts. Exercise an
  unavailable data source, then retry; saved data must remain available.
- In both search screens, disconnect the network and retry. Keep saved people and
  direct public-key results usable; restore the connection and verify that results
  update without retyping the query.
- Interrupt a pending transfer status check. Keep its payment pending, show the
  verification guidance, and check History before creating another payment.
- Repeat with large system text and a screen reader. Loading and error messages,
  retry controls, and progress labels must remain readable and reachable.

These checks concern presentation. They do not change payment execution, mint
validation, authentication, or recovery rules.
