# Connected mint sheet

Connected mint rows on Home and in mint management open the approved sheet. Discovery,
the full mint details screen, payment mint pickers and bulk selection keep their existing
behavior. The BUI Sheets gallery uses the same layout with isolated sample data.

The compact header shows the name and copyable URL. Rename edits the header title; Done
replaces Remove while editing. Saving uses the existing nickname store operation and checks
the refreshed mint before leaving edit mode. Cancel discards the draft. Copy uses a small
checkmark and optional light haptic, without an inline success message.

The sheet shows live balances using the wallet's currency and hidden-balance preferences.
Connection is the first information row. Offline mints have a refresh control; device-offline
state disables network refresh. Units and payment methods come from advertised metadata;
payment methods wrap fully. Transfer and Recover funds are the primary actions. QR and
Rename are immediately visible, with View full mint details last.

Transfer passes the selected source mint to the existing flow. Recovery passes its mint URL.
The full-details action closes the sheet before opening the existing screen. No action changes
the active mint just to navigate. QR uses the existing mint URL overlay.

Removal uses `inspectConnectedMints` for its initial state and `removeConnectedMints` for the
transactional confirmation. A positive balance, pending activity, recovery, or unknown state
blocks removal. Eligibility is rechecked at confirmation, duplicate submissions are locked
out, and the UI stays mounted until the result is known. Transaction history remains intact.

The sheet hides on lock, lost focus or background, cancels queued navigation and does not
reopen on resume. QR visibility follows the same privacy gate. These changes do not alter
proof handling, seed/recovery semantics or payment execution, and add no dependencies.

## Validation

Focused checks cover live metadata/balances, hidden balances, offline refresh, navigation
after dismissal, header nickname persistence/failure, eligibility changes, duplicate removal,
background/lock privacy, connected-mint entry points and unchanged discovery/bulk selection.
Existing mint-details, transfer-source, BUI gallery and removal repository tests are included.

Local results: **89 tests passed across 9 suites**. TypeScript, the 94-route structure check,
button conventions, scoped formatting and `git diff --check` pass. The missing Home
`openMint` binding encountered during wiring is fixed and covered by the entry-point tests.

Main files are `src/features/mints/components/ConnectedMintSheet.tsx` (live controller),
`ConnectedMintSheetView.tsx` (shared layout), and `src/features/mints/hooks/useConnectedMintSheet.tsx`
(screen ownership). Home's `ConnectedMintsCard.tsx` and `MintsScreen.tsx` use the hook.
`MintSheetDesignPreview.tsx` and `BUISheetsScreen.tsx` retain the isolated gallery preview.
Regression coverage is in the two `connected-mint-sheet` test files and `mint-url-navigation.test.tsx`.

Device checks still needed in the EAS dev client:

- Open from Home and mint management; close via X, swipe, backdrop and Android Back.
- Rename using the header input and Done, cancel, and verify keyboard/safe-area layout.
- Verify long names/URLs and all advertised payment methods remain readable.
- Retry an offline mint; check device-offline behavior and loading feedback.
- Exercise Transfer, Recover funds, QR and the final full-details link.
- Verify hidden balances, background/lock, and empty-mint removal confirmation.

No new native build is required for these JavaScript changes.
