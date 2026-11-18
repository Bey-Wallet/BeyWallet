# Support diagnostic reports

Settings → Help & support → Diagnostics shows the report before the user copies,
shares, or opens a GitHub issue. Reports are never uploaded automatically. Opening
GitHub does not put report content in the URL; the user pastes and reviews it there.

The automatic snapshot includes app version/build, platform, OS/API level, model
when available from React Native, update runtime/ID, development/release JS mode,
wallet initialization/error flags, network status, configured relay connection
counts, and aggregate cached checks for connected mints. It excludes device names,
serials, wallet identifiers, balances, contacts, mint/relay URLs, invoices and secrets.

Mint checks reuse the mint metadata query cache. Refreshing diagnostics reads a new
snapshot and native network status; it does not contact mints, make payments or send
analytics. Unchecked means no cached observation, not an offline mint. Native
network status has a five-second timeout; other report data remains usable if it fails.

## Recent errors

The in-memory history retains at most 20 entries for the current app session and
combines consecutive identical errors within 30 seconds. Entries contain only a
fixed operation label, timestamp, elapsed duration when available, allowlisted
error class, numeric protocol/HTTP codes and occurrence count. Raw error messages,
stacks and arbitrary metadata are never retained or inspected by this recorder.

Instrumentation covers wallet startup/refresh, SDK errors, mint quote creation and
issuance, Lightning preparation/submission/status, ecash preparation/send/receive,
transfer submission and Settings actions. These are observed exceptions, not final
payment outcomes: a timed-out submission may still settle. History remains the
source for payment status. Not every operation error can supply a protocol code.

Records clear on app restart, wallet reset, or the Clear recent failures action.
Scoped asynchronous observers drop failures from work that began before a clear.
The feature performs no storage writes and adds no dependencies or permissions.

## User-provided details

What happened, expected behavior and reproduction steps are optional, bounded text
fields. Common bearer tokens, keys, English recovery phrases, URLs, public keys,
email addresses and amounts are redacted before they enter the preview. Redaction
is a convenience; users must review their own text and avoid personal information.
The screen retains drafts only in component memory. Copy and native Share use the
exact visible report. Native sharing cancellation does not claim a report was sent.

## Verification

Automated tests cover field allowlisting, hostile error getters, bounded retention,
coalescing, reset isolation, secret redaction, cached mint health, exact-preview
copy/share, explicit GitHub navigation and share failures. Wallet/payment regression
tests check that observation preserves results and the original thrown error.

On Android, open Diagnostics in both themes and verify model/OS/update fields. Enter
a short reproduction, copy/share the preview and refresh offline. After reproducing
a payment issue, refresh the report before restarting the app. Confirm that recent
errors clear after restart and that GitHub opens without report text in its URL.
