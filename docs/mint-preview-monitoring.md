# Mint preview monitoring

The `mint-profile` preview and connected `mint-details` screen share the
monitoring, payment-method and QR components. Connected details retain the
balance/avatar, trust badges, payment actions, Restore and Remove layout.
Mint information appears directly below the balance and payment actions.
The former collapsible About Mint and transaction list are removed, including
their history fetch and obsolete auditor queries. A header pencil switches
the title to an inline nickname input; the check button persists it through
the existing wallet store. Failed saves retain the draft for retry.
Entered and scanned URLs open the full profile. Opening a preview never registers or trusts a mint.
Connect opens a disclaimer sheet with the mint's image, name, and exact URL.
Only Confirm calls the existing wallet add operation with SDK validation.
Duplicate submissions and dismissal/navigation are blocked while connecting;
wallet errors remain visible in the sheet for retry.
Confirm uses the shared button spinner while connecting. Once connection
finishes successfully, the preview is replaced with the updated `mint-details`
route. Opening an already-connected mint's profile URL uses the same route;
the preview's old connected presentation is not displayed. Navigation waits
until the add operation completes, even if its mint list updates earlier.

The mint icon sits beside its left-aligned name and exact URL. A compact
ListTable below the identity displays the reliability score and then Connection,
without source or timestamp captions. Share and Show QR follow the table.
Both screens put a Recheck mint connection icon beside the connection status.
It refetches `/v1/info` directly even with fresh cached metadata, displays a
spinner while checking, and updates green Online or red Offline on completion.
Repeated taps reuse an ongoing request. Direct checks use network mode always
so an offline device gets a live fetch failure instead of a paused cached status.
Mint messages and About use padded ListTable cards with
full-width paragraphs. The QR uses the saved
full-screen overlay treatment in `mint-qr-overlay.md`, with a white surround,
selectable URL, Close QR action, and native back dismissal.

## Data sources

Discovery merges MintRadar's stable wallet mint list with NIP-87 announcements
and reviews from relays. It requests all four inclusion flags (offline, archived,
test, unscored) and the API's maximum limit of 200. The verified live directory
contained 61 mints, including 50 online, on 2026-10-20. The API has no cursor;
200 is the upstream maximum, not a promise of unlimited future coverage.
The discovery screens keep their incremental rendering without truncating the
merged results. URL deduplication preserves path case, ports, and schemes.
Online mints sort first. Home's short recommendation list remains limited to 20.
Relay and provider requests run independently; either source can supply results
when the other fails, with the saved MintRadar directory as an offline fallback.

- Connection is a direct, read-only `/v1/info` check from this device. A service
  failure from either monitoring provider does not mark the mint offline.
- MintRadar's stable `/api/v1/wallets/mints/{encoded URL}` supplies the published
  reliability score out of 100, displayed as a percentage in a ListTable row
  below the mint identity. The reliability details explain that it measures
  observed operation rather than reserves or fund safety.
  New-mint score caps remain identified.
- `https://cashu.info/api/v1/mints` resolves the exact URL to its auditor ID.
  `/api/v1/mints/{id}` supplies independent uptime and seven-day payment tests.
- Payment success is successful / total tests, including the sample counts.
  Receive and Send test results remain separate. Attributed failures are shown
  independently from total failed routes. Uptime is never derived from swaps.
- Neither API exposes a mint's total reserves. The balance/reserves row says
  **Not published**. Auditor-held test funds and test volumes are not reserves.
- Server country comes from cashu.info's reported network country, with bundled
  English ISO country names so Android does not require Intl.DisplayNames.
  Missing country data displays Unknown. This is not the operator's nationality.
- Payment methods and limits are mint-reported metadata; each method, direction,
  and unit keeps its own limits. Zero limits and zero confirmations are preserved.
  These labels do not change the wallet's supported payment capabilities.
- Unit labels come from the advertised units/payment methods. NUT-14 support
  does not imply USD support.

Sources: [cashu.info auditor](https://github.com/gorrdy/cashu-auditor),
[MintRadar wallet API](https://github.com/hroomnik007/MintRadar/blob/main/MintRadar/docs/API.md).

## Cache and failure behavior

Validated public reports are persisted in SQLite under `mint-health-v1:` keys
and restored immediately through React Query. They have a five-minute freshness
window; Check again refreshes the device check and both providers. No extra
dimming or adjacent loading spinner is introduced. Each HTTP request has an
eight-second timeout and consumes query cancellation. A failed or invalid
response never overwrites a saved report. URL paths, ports, and schemes remain
significant when assigning a report to a mint.

Missing coverage, provider failure, missing samples, and real zero scores are
distinct states. Provider timestamps remain visible; saved reports are identified
when a refresh fails. An offline mint can still show previously fetched metadata
and independent reports. A score is an operational observation, not proof of
backing or a guarantee that funds are safe.

Device checks still required: light/dark themes, long URLs and large text,
native sharing, QR scanning/dismissal, offline cached reports, returning from
the connection confirmation sheet, inline nickname keyboard focus/save/retry,
and the connected balance and payment action layout.
