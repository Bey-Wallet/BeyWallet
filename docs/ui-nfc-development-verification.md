# UI and NFC development verification

The development client uses Expo SDK 54, React Native 0.81.5 and the New Architecture.
Install with the pinned Yarn 4.5.0 release. `postinstall` applies the repository's
`react-native-hce@0.3.0` patch; native changes require rebuilding the client.

## Receiving a request over NFC

An unrestricted, focused request advertises a writable NUT-18 request with its original
ID, mint, unit, amount and description and no Nostr return transport. Restricted requests
continue to require their authenticated return transport.

The Type 4 handler keeps outgoing and incoming bytes separate. A complete, valid NDEF
message must be stored using `AtomicFile` in Android's app-private `noBackupFilesDir`
before a write is acknowledged. One unprocessed payment occupies the slot; another
payment cannot overwrite it. Interrupted fragments are discarded on deselection.

The receive coordinator checks request association, mint trust, SDK metadata and the
net amount after input fees before calling the existing wallet service. It verifies
the exact original proofs against a successful local receipt before marking the
request received and acknowledging the native slot. A durable fingerprint/receipt
association prevents settling different NFC requests with the same payment.

Startup recovery checks local receipts first. Failed or uncertain payments remain
available through **Review NFC payment**; retry never treats a write, tap or spent
proof observation as success. Advertising stops while receiving, when leaving the
request, on locking and on backgrounding. Android also requires device unlock.
Native enablement belongs to the current process; a cold native service cannot resume
an old tag before the wallet starts a new session. Receipts predating the native offer
must already be associated with that request. Writes arriving during startup reads
trigger another read rather than being lost.

## Automated checks

- `node scripts/test-hce.cjs`: compiles and runs the actual patched Type 4 file transport
  with Java 17. Covers short/256-byte reads, selection, bounds, fragments, missing bytes,
  rejected commits, read-only tags and failed persistence. Android's NDEF parser and
  physical radio timing still require a device.
- Jest regressions cover request terms, mint trust, lock checks, duplicates, receipt
  recovery and failure retention, plus image fallback, request currency input and
  People search/scroll restoration.
- Run `yarn typecheck`, `yarn check:structure`, changed-file Prettier checks,
  `yarn expo install --check` and native compilation before distributing a build.

The Expo dependency check currently reports pre-existing SDK version mismatches,
including SDK 55 versions of notifications and linear gradient. These were not part
of the requested dependency migration.

## Development client and device acceptance

Build with `eas build --platform android --profile development`; use
`yarn expo start --dev-client` for development sessions. This creates an internal APK.
It does not publish an OTA update or submit an app to a store.

With small amounts, check on two NFC-capable Android phones:

- Cashu Android reads Bey's request, writes back its token, and Bey redeems and shows success.
- Bey pays a Cashu NFC request; QR request payments still complete.
- Interrupted contact/retry preserves the existing payment without duplicate redemption.
- Restart after a completed write, network failure or completed receive recovers the saved payment.
- An untrusted mint, wrong amount/unit/mint, or locked wallet does not redeem or show success.
- Concurrent QR/NFC responses and repeated taps never reuse one receipt for two requests.
- NFC toggling, navigation, backgrounding and lock/unlock stop and resume advertising correctly.
- Small screens, large text, hidden balances, reduced motion, rapid number changes,
  refresh/pagination, restored list positions and cached-image fallbacks remain usable.

Cloud compilation and automated checks do not establish two-phone interoperability.

## Validation results

- Before rolling-number restoration, focused Jest regressions recorded **142 passing
  tests across 14 suites**, using the latest run of each suite. After restoration and
  request-sheet improvements, the focused request suite passed **16 tests** and the
  image suite passed **2 tests**. The full aggregate was not rerun after these UI changes.
  The real SQLite integration suite uses Node's built-in SQLite engine
  when available and skips on older Node versions.
- `yarn typecheck`, `yarn check:structure` and changed-file Prettier checks passed.
- The Java transport regression harness passed.
- The HCE patch applied successfully to an untouched HCE 0.3.0 Yarn package archive;
  every resulting patched file matched the installed implementation.
- SQLite checks verified fingerprint deduplication, receipt ownership, metadata
  preservation, refusal of unsuccessful receipts and transaction rollback.
- Full Android compilation, native linking, signing and APK packaging **passed on EAS**.
  The build completed on 2026-10-18 at 05:57 UTC (`BUILD SUCCESSFUL in 13m 26s`).
  [Build details](https://expo.dev/accounts/thehussein01/projects/bey-wallet/builds/4e6166b2-0fa2-4c86-b5e3-f6c2cf99fe16)
  · [Download the development APK](https://expo.dev/artifacts/eas/Jo-EDakiANpWs1bGAv-kUbRh_40PJr8cgBJ1bg8YyjM.apk).
  Local Gradle attempts were limited by insufficient Windows JVM memory.
- Expo's dependency check reports the existing SDK version mismatches described above.
- Two-phone NFC request reading **failed in user device testing**, as recorded below.
  The other device acceptance checks remain unverified.

## Unresolved device failure: NFC request cannot be read

Reported on 2026-10-18 after installing the development build linked above.

1. On Bey Wallet, create a new request and leave its request screen open.
2. On a second Android device, use Minibits or Cashu me Android wallet to tap to pay.
3. Tap the devices together to read Bey's request.

Expected: the paying wallet reads the NDEF request, offers payment, writes back its
payment token, and Bey validates and redeems it before showing success.

Observed: both paying wallets fail to read the NFC tag. The user reports the same
failure as before this build: **"failed to read NFC tag"**. Minibits specifically
shows **"No NDEF message found on the tag"**; Cashu me also fails at tag reading.
The Cashu me message was described as the same failure, without a separate verbatim
message. Device models, Android versions, wallet versions and APDU traces were not
provided. Payment write-back and redemption were not established by this test.

Status: **unresolved**. Cloud build success and the automated transport tests do not
prove that Android readers discover and read the advertised NDEF message. The root
cause is not yet established. This commit records the current implementation and
failure; it does not claim to fix device-to-device interoperability.

Follow-up for the next fix commit:

- Reproduce with both Minibits and Cashu me and record device/app versions.
- Capture non-sensitive HCE lifecycle and APDU command/status diagnostics; exclude
  request/payment bearer data, proofs and secrets from logs.
- Investigate Android tag discovery, application/file selection, capability-container
  reads, NDEF length/content reads and request-session activation before changing code.
- Add regressions for the demonstrated cause, rebuild the development APK if native
  changes are needed, and repeat both reading and small-amount end-to-end payments.
- Verify interrupted contact/retry and duplicate-payment protections on devices.

No follow-up NFC fix is included in this commit.

## Changed files

The adaptive-icon update is included. The obsolete FlashList patch was removed.

- `package.json`
- `src/assets/icons/adaptive-icon.png`
- `patches/react-native-hce+0.3.0.patch`
- `plugins/withHce.js`
- `scripts/test-hce.cjs`
- `src/features/explore/components/MintIcon.tsx`
- `src/features/explore/components/mintMeta.ts`
- `src/features/history/components/HistorySection.tsx`
- `src/features/history/index.tsx`
- `src/features/home/components/Balance.tsx`
- `src/features/home/components/ConnectedMintsCard.tsx`
- `src/features/home/components/NostrActivity.tsx`
- `src/features/mints/MintDetailsScreen.tsx`
- `src/features/mints/index.tsx`
- `src/features/nfc/NfcSheetHost.tsx`
- `src/features/nfc/nfcFlow.ts`
- `src/features/nostr/components/NostrClaimSheet.tsx`
- `src/features/payments/OptimizeWalletScreen.tsx`
- `src/features/settings/ProofManagerScreen.tsx`
- `src/features/payments/SearchScreen.tsx`
- `src/features/payments/receive/RequestDetailsEditor.tsx`
- `src/features/payments/receive/RequestEcashStage.tsx`
- `src/features/payments/receive/RequestNfcBadge.tsx`
- `src/features/payments/send/PaymentRequestStage.tsx`
- `src/features/people/components/ConversationAvatar.tsx`
- `src/features/people/components/NostrProfileItem.tsx`
- `src/features/people/index.tsx`
- `src/services/platform/nfcService.ts`
- `src/services/wallet/historyService.ts`
- `src/services/wallet/nfcReceiveCoordinator.ts`
- `src/services/wallet/nostrReceiptService.ts`
- `src/shared/ui/HomeMintSelector.tsx`
- `src/shared/ui/MintBalanceRow.tsx`
- `src/shared/ui/RemoteImage.tsx`
- `src/shared/utils/mintIcon.ts`
- `src/storage/sqlite/repositories/nfcRequestReceipts.ts`
- `src/storage/sqlite/schema.ts`
- `tests/integration/nfc-request-receipts.test.ts`
- `tests/unit/native/Type4FileTest.java`
- `tests/unit/nfc-flow.test.ts`
- `tests/unit/nfc-receive-coordinator.test.ts`
- `tests/unit/nfc-request-actions.test.tsx`
- `tests/unit/nfc-sheet-dismissal.test.tsx`
- `tests/unit/nostr-receipt-service.test.ts`
- `tests/unit/people-conversations.test.tsx`
- `tests/unit/request-generation-feedback.test.tsx`
- `tests/unit/ui-library-adapters.test.tsx`
- `yarn.lock`

## Rolling-number restoration

The original pre-migration RollingNumber implementation has been restored in full,
including Tamagui Text, character wrappers, spacing and refresh-trigger behavior.
The Bankify package and its TypeScript/Jest support are removed. Number-adapter tests
introduced for that migration have been removed; the image regressions remain.
The earlier 142-test result describes the migration before this restoration.
This JavaScript change loads through Metro in the existing development client and
does not require another native build.

## Request amount sheet

The editor opens using the primary currency when its conversion price is available,
supports switching between sats and the configured secondary currency even at zero,
and displays the live equivalent below the input. It honors the Bitcoin-symbol setting
and adds the device's bottom safe-area inset and content padding. Disabling secondary
currency keeps input in sats; missing prices fall back to sats with conversion
unavailable. Saved requests remain whole satoshis, preserving the existing conversion
rounding and exact satoshi amounts when switching without editing.

The created APK predates these subsequent JavaScript UI changes and the complete
rolling-number restoration. The existing development client loads the current code
through Metro; no later APK or OTA update was created for these UI changes.
