# Shared NFC sheet

The single root-mounted `NfcSheetHost` presents NFC over the current screen. The home
shortcut, Receive input, Send input, and `PendingTokenLayout` sharing actions use
`nfcFlow.openReader()` or `nfcFlow.openSend({ token, amount, mintUrl, operationId? })`.
Send results and History pass their operation IDs. Proof-created tokens use the
same sharing layout without creating a send operation.

The coordinator retains tokens and controllers in memory. Closing a pending flow
stops NFC and visible polling while retaining its operation. Reopening checks the
existing operation. Delivery retries write the saved token to the same verified
request. Repeated requests and invoices retain their controllers for this app
session, including after Done. An NFC delivery acknowledgement remains pending;
outgoing confirmation requires every proof to be spent and, when an operation ID
exists, the operation to be finalized. Backgrounding stops NFC and does not replay
payments on foregrounding. Normal authentication applies after visiting NFC settings.

The sheet has a larger minimum content height, progress indicators for active NFC/payment work,
and an inline error area. Status refreshes show a button loader. Native/network errors are mapped
to fixed messages so payloads and proofs cannot appear in the UI.

Pending, unconfirmed and failed payments offer **Try new payment** after wallet work finishes.
This closes the old NFC session and starts a fresh reader without cancelling or reclaiming the
previous payment. The sheet warns that the old payment may still complete and links to History.
Request/invoice controllers remain in their session deduplication maps: scanning the same request
or invoice checks its existing operation instead of submitting another payment. Late status checks
cannot overwrite the new session. A send contact that never reports disconnection becomes
unconfirmed after 20 seconds, retaining its token for status checks or delivery retry. This contact
timeout never interrupts wallet mutations; they continue to block dismissal and new payments.

Physical card/sticker writing and the dedicated NFC routes have been removed.
Same-session Numo token write-back remains. The native-intent adapter accepts the
old NFC launch URLs, opens Home on cold launch, and preserves the current screen on
warm launch. Presentation waits for wallet initialization, settings and authentication.

## Validation

Automated regressions cover the entry points, automatic payment once, controller
reuse, token receiving, delivery retries, complete proof spending, pending closure,
receipt timeout, backgrounding, late reads, mode cleanup, dismissal guards,
disabled/unsupported devices, and cold/warm native intents. Existing payment request,
Cashu keyset/recovery, Lightning controller, Nostr claim and Android registration
regressions are also run. QR confirmation components and payment validation services
are unchanged.

An Android APK build was attempted with workspace and temporary Gradle caches. It
stopped before app compilation because the React Native Gradle build could not
resolve `org.gradle.toolchains.foojay-resolver-convention:0.5.0`, both offline and
with dependency resolution enabled. Packaged manifest verification remains outstanding.
The Android export resolved all 4,573 JavaScript modules but Hermes bytecode generation
could not execute `hermesc.exe` (permission denied in this environment).
The follow-up export with `--no-bytecode` passed and wrote the Android JavaScript
bundle and assets to `.tmp/nfc-android-export`. This verifies module bundling, not
the APK or native NFC behavior. TypeScript, targeted formatting, the 35-route
structure check and 105 focused/existing regressions passed.

## Changed files

- Added `src/features/nfc/{nfcFlow.ts,NfcSheetHost.tsx,nativeIntent.ts}` and the thin
  `src/app/+native-intent.tsx` adapter.
- Updated `RootLayout`, `RootLayoutNav`, the tabs/modal layouts, Receive `InputStage`,
  Send `ScanAndPayStage`/`ResultStage`, `PendingTokenLayout` and `TransactionDetailsScreen`.
- Updated `AppBottomSheet` dismissal guards and iOS overlay support, `nfcService`
  session cleanup, and the Nostr/username/OTA prompt presentation gates.
- Removed both NFC route wrappers and screen implementations, the physical writer
  helpers, the NFC `ProcessingSheet` variant and `NFC-fill-2.tsx`.
- Updated `scripts/check-structure.mjs`; replaced the old screen test with coordinator,
  entry-point and dismissal regressions.

The pre-existing `RollingNumber.tsx` working-tree change was preserved.

## Device checks still required

- Numo Cashu-only and unified request payments, including same-contact write-back.
- Phone-to-phone sending/receiving from Home, Send, Receive, History and proof sharing.
- Disabled NFC and returning from settings with the normal authentication requirement.
- Contact loss, delivery retry to the same request, and refusal of a different request.
- Closing pending flows, reopening, settlement, and success remaining visible until Done.
- Inline errors and loaders, status refresh failures, stuck send contacts, and starting a different
  payment while the previous payment remains unresolved. Scan the old request/invoice again and
  confirm it is reconciled without a second charge.
- Close, Android Back, backdrop and swipe during reading, writing and settlement.
- Backgrounding while reading, broadcasting and mutating the wallet; no automatic replay.
- Cold Android NFC launches, onboarding/initialization/authentication gating, warm launches.
- Working QR flows and automatic prompt deferral; screenshots of the sheet on real devices.

The previously reported receiving-recognition and Lightning defects are separate
tasks. They have not been fixed or independently reproduced during this refactor;
device runs should record those failures separately from sheet regressions.

## Reverted Android token-transfer attempt

An attempted fix for ordinary phone-to-phone Android NFC transfers was reverted
after the user reported that it broke compatibility with Numo Pay. Those changes
are no longer part of the implementation. The specific cause of the Numo Pay
regression was not established.

The attempt addressed two reported issues: Bey sends to Minibits/Cashu.me failed
with “Tag does not support NDEF,” and receiving from those wallets could show
Android's wallet selector while Bey's receiving sheet was open. It included a
`react-native-hce` protocol patch, foreground HCE preference, explicit reader-mode
ownership, ISO-DEP Type 4 fallback reads/write-back, and retained reader ownership
after connection failures.

The attempted changes passed 101 focused automated tests, Java protocol checks,
TypeScript, formatting, structure checks, Android compilation and packaged NFC
registration inspection. Those results applied to the reverted implementation
and did not establish device interoperability or Numo Pay compatibility.

The Minibits/Cashu.me issues remain unresolved. Any future fix must first reproduce
the failures and preserve Numo Pay Cashu-only and unified request payments,
including same-contact token write-back. Verify transfers and settlement with
Numo Pay, Minibits and Cashu.me on real devices before considering the fix complete;
record wallet versions, phone models and Android versions. Do not reapply the
reverted approach without investigating the Numo Pay regression.
