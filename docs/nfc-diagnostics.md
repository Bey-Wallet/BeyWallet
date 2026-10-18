# Android NFC discovery diagnostics

NFC request reading, offer delivery, redemption, request completion, and the transaction
details screen have now succeeded on the connected Android 16 phone with build 8 and
the current development JavaScript. The user confirmed the fee message in transaction
details. This succeeded after the user explicitly authorized receiving the requested
face value with uncovered mint receiving fees deducted. Interrupted contact/retry,
duplicate-payment protection, and other device pairings still require device acceptance.

Diagnostics themselves do not change transport responses, durable write-back, wallet
locking, or receipt verification. The later receiver-fee policy change is documented
below. No dependencies, seed derivation, or recovery semantics were changed.

In an Android development build, open a receive request and select **NFC diagnostics**
beside its NFC indicator. Refresh reads the native buffer. Copy report reads it again
and copies the report with app version/build, Android version, device model, and
diagnostic implementation version. Clear empties the buffer without stopping NFC.
Opening the sheet leaves request advertising active.

Native collection requires the installed application's Android debuggable flag.
The buffer exists only in process memory, retains the latest 256 events, and resets
when a new advertising session starts (`setRequestSession`). Release builds collect
no events. Events contain fixed names, numeric offsets/lengths, response status codes
(decimal: 36864 = 9000 success, 27264 = 6A80, 27266 = 6A82), and fixed failure categories.
No APDU payload, request content, token, proof, request identifier, exception message,
or device identifier is recorded. Device model is included only as report metadata.

Expected discovery order:

1. REQUEST_READY, CONTENT_READY, FOREGROUND_PREFERRED, ADVERTISING_ON (v2).
2. SERVICE_CREATED (if Android creates a new service), ACTIVATED, SELECT_APPLICATION.
3. SELECT_CC, READ at offset 0 (the reader may split the capability-container reads).
4. SELECT_NDEF, READ at offset 0 for length 2, READ at offset 2 for the message.
5. DEACTIVATED after contact ends. A later tap can reuse the service.

If advertising starts but no ACTIVATED event appears, Android has not delivered an
APDU to Bey. This narrows the investigation to discovery/routing; it does not establish
the cause. Otherwise use the first missing or rejected stage to reproduce the defect.
Service creation and RF activation are distinct events; Android reports RF activation
to this service through its first APDU.

## Verification and device acceptance

- Run `node scripts/test-hce.cjs` for the production service/application/file discovery
  path with JVM Android adapters, buffer/privacy tests, and existing write tests.
  These adapters do not simulate Android RF discovery or validate Android NDEF encoding.
- Run focused NFC Jest tests, `yarn typecheck`, `yarn check:structure`, and Prettier
  checks for changed JavaScript/TypeScript/Markdown files.
- Build with `eas build -p android --profile development`. Inspect the resulting APK
  for native diagnostic methods/events and its HCE service registration and NDEF AID
  D2760000850101. A development client needs the development server to run the UI.
- Install as an update with the same application ID and signing certificate; do not
  uninstall or clear wallet data. If Android rejects the signature, stop and resolve
  signing rather than uninstalling.
- Create an unrestricted Bey request, reproduce the cashu.me tap, then copy the report.
- Reproduce the first failing discovery stage in a regression test before changing
  transport behavior. Build and inspect the corrected APK.
- On two phones verify request reading, a small same-mint payment, interrupted
  contact/retry, and duplicate-payment protection. Keep interoperability unresolved
  until this succeeds. Device installation, RF discovery and payment acceptance
  cannot be established by the local JVM/Jest suites.

## Implementation validation (2026-10-18)

- NFC Jest suites: 9 passed, 78 tests passed, including diagnostics UI actions,
  report metadata, fixed error reporting, and development/Android visibility.
- Native JVM suites: discovery sequence, transport bounds/write behavior, diagnostic
  retention/reset, failure categories, bearer-data exclusion, and release gating passed.
- TypeScript, structure check (36 routes), and changed-file Prettier checks passed.
- The broader Jest run reported 73 passing suites and 3 failing suites (4 tests):
  fiat decimal entry in `request-generation-feedback`, a missing payment-check control
  in `mint-payment-result`, and spinner animation mocks lacking `Easing.bezier`.
  Those implementations are outside this change. The fiat failure also reproduced
  when running its suite alone.
- No authorized Android devices were attached during the initial validation.

## Current development APK (build 8, diagnostics v2)

[Download build 8](https://expo.dev/artifacts/eas/uc__NiBx2VGuFSK3dxAg4xIz8xkRb41HzM5Hyc0mDxs.apk)
([EAS build](https://expo.dev/accounts/thehussein01/projects/bey-wallet/builds/ad64d832-e1c1-4884-b247-2028442c617d)).

The downloaded APK contains compiled foreground routing and lifecycle cleanup
methods, the diagnostic bridge, the NDEF AID, and Text dispatch registration.
APK signature verification passed with the same signing certificate as build 7.
Installed over USB with `adb install -r`; the installed build number is 8 and its
SHA-256 matches the inspected artifact:
`2a6817452c314e4c828fcff1ef122c8e380c59749d48d7671433869b305a88e4`.
The installation did not uninstall the app or clear its data.

Validation: all 9 NFC Jest suites (78 tests), native discovery/transport/routing
suites, Android SDK compilation, TypeScript, structure, and changed-file formatting
checks passed. The user reported receiving the two-phone payment from cashu.me;
this did not independently establish successful wallet redemption (see follow-up below).
The native trace independently confirmed foreground preference, application/file
selection, CC and NDEF reads, and the complete write-back sequence, all with `9000`
success responses. Advertising then stopped and the foreground preference was released.
Android's NFC state confirmed the default wallet was unchanged and Bey was no longer
registered as an active advertising service after completion.

The successful trace included the NDEF length read, message read, write initialization,
three payload fragments, and final NDEF length commit. No bearer data was collected.
Other devices, interrupted contact/retry, and duplicate-payment protection still need
device acceptance checks.

## Follow-up: saved payment review and request completion

Read-only inspection found the durable NFC slot populated, its request still pending,
and no matching successful local receive receipt. The compact input keyset ID could
not be resolved against the mint's advertised keysets. This is a redemption failure
after successful NFC delivery; transport status `9000` alone is not payment evidence.
Only state flags and fixed failure categories were returned from the runtime probe.

The request UI previously disabled all amount and detail editors whenever any NFC
offer needed review, even after pressing New request. Review now locks the original
request while permitting a new QR request. NFC remains paused and the durable offer
remains available for retry. Unknown-keyset review has a fixed explanatory message,
which repeated automatic processing preserves without another redemption attempt.

After an exact successful local receipt is associated with its request, the request is
marked received and the native slot is acknowledged as before. Only then does the
coordinator expose that receipt's ID. The request screen replaces itself with the
existing transaction-details route for that ID, once, without inserting another
History entry. Validation, fee checks, duplicate protection, wallet locking, and
receipt verification remain intact. The unmatched-keyset offer is not marked paid
or discarded. A fresh verified two-phone payment must still confirm this UI path.

Follow-up validation: 63 coordinator, receipt, keyset, and NFC flow tests plus four
focused request UI tests passed; TypeScript, structure, and changed-file formatting
checks passed. The complete request UI suite retains its pre-existing fiat input
failure (`.` versus `0.`). The development app was reloaded over USB and an explicit
retry confirmed the new fixed unknown-keyset explanation on the device. The offer
remained in review without a verified receipt. The request controls and successful
transaction-details transition still require direct device acceptance; the request
screen was not visible during the automated UI inspection.

A subsequent connected-device check of a new request found `requestStatus=paused`,
`requestPauseReason=payment`, coordinator status `review`, and the original durable
offer still present. Native diagnostics showed no new activation after advertising
was stopped. Thus the reported new NDEF discovery failure occurred while Bey was
intentionally not advertising; it is not evidence of a new discovery transport defect.
The user confirmed the sender displayed Paid/success and the mint selection matched.
A read-only NUT-07 check returned two UNSPENT inputs, zero SPENT, and zero PENDING.
Proof state alone neither validates signatures nor establishes a receive receipt.
The compact keyset still had no match in either advertised or cached keysets. Do not
clear the saved offer or mark its request received from the sender's UI status or
from proof-state checks. Do not ask for another payment tap until NFC is actually
advertising and can durably accept its write-back.

After the user recreated the wallet, live inspection found empty History, no saved
request matching the native pending offer, and the same 44-minute-old offer still in
Android's no-backup file. Wallet database deletion does not remove this native file.
This orphan continued to hold the coordinator in review; the pasted APDU report was
the earlier transfer, not a new failed discovery trace.

For this connected development device, advertising was verified off and the missing
request was confirmed before atomically moving `no_backup/nfc-payment.json` to
`no_backup/nfc-payment-before-wallet-reset-20261018.json` within the same app-private
directory. No contents were printed, no data left the device, no offer was marked
paid, and no existing archive was overwritten. This is a one-time preservation step,
not automatic resolution of unknown-keyset payments or a permanent wallet-reset
archive feature. Keep the recovery file available for subsequent investigation.

The coordinator now releases stale review when an unlocked foreground check confirms
the authoritative native slot is empty, preserving completed receipt state when
already idle. Regression tests first reproduced the stale review, then passed along
with NFC flow tests (53 tests total) and TypeScript. After reload the device reported
idle and no active saved offer. A request must still be opened and readiness verified
before the next live tap.

The next live request was verified ready, foreground-preferred, unlocked, and free of
an active pending offer before asking the user to tap. Its new trace completed
application/CC/NDEF selection, length/message reads, fragmented writes, and the final
length commit with `9000` responses. The new offer's age was zero minutes, its request
was present, compact IDs decoded successfully, and all proof keysets were advertised.
The first failing stage was the net-amount check: gross input value equaled the request,
but a positive receiving fee made net value smaller than requested. No successful
receive receipt existed. The mint had no active zero-fee sat keyset; inputs were from
an active keyset. The user reported no sender option to include receiving fees.

[NUT-18 input fees](https://github.com/cashubtc/nuts/blob/main/18.md#input-fees)
requires the sender to cover input fees in addition to the requested amount. Bey's
fee checks were retained. Underpayment now produces a fixed explanatory review
message, while invalid fees and other net mismatches remain rejected. No amounts,
bearer data, or exception messages were added to diagnostics. Coordinator, receipt,
keyset, and NFC flow suites passed (69 tests), as did TypeScript. The fresh underpaid
offer remains in the active native slot; it has not been redeemed, marked paid, or
archived. End-to-end successful payment acceptance remains unresolved even though
this fresh NFC discovery and delivery succeeded.

## Receiver-authorized fee acceptance and verified completion

The Minibits test initially hit the same paused advertising state because the cashu.me
underpaid offer was still active. After confirming it remained unredeemed, its file
was atomically preserved as `no_backup/nfc-underpaid-before-minibits-20261018.json`
without overwriting the older recovery file. The coordinator's normal empty-slot
check then returned to idle. A live ready-state check confirmed foreground preference
and active advertising before inviting the Minibits tap. That tap completed discovery,
NDEF reads, fragmented writes, and final length commit; its first failure was again
positive input fees on a token containing only the requested face value.

The user then explicitly instructed Bey to accept the payment whether or not the
sender covered fees and show a message if not covered. The NFC policy now requires
the token's gross face value to cover the saved request, validates the mint's fee,
and requires positive net value. It accepts receiver-covered fees and records
`requestedAmount`, `fee`, `netAmount`, and `receivingFeeCovered` on the existing
successful receipt. This is the receiver's chosen compatibility policy; it does
not assert that an underfunded net payment satisfies NUT-18's sender-fee requirement.
Mint trust, advertised keysets, proof validation, exact receipt matching, receipt age,
request ownership, wallet locking, and duplicate protection remain enforced.

Receipt metadata and its request association commit in the same SQLite transaction.
The recorded net plus fee must equal the stored gross input amount; mismatches roll
back. History and transaction details display the validated net amount while the
stored gross amount and original proofs remain available for exact receipt matching.
Details shows the fee and, when uncovered, "The sender did not cover the receiving
fee. It was deducted from this payment." No new History entry is inserted for the
fee or request completion.

The saved payment was retried through the normal coordinator. Read-only device checks
verified a successful NFC receive, exactly one receive entry associated with that
request, valid persisted fee/net arithmetic, completed request state, and an empty
active native slot. The user confirmed transaction details displayed the fee message.
The two private recovery files remain preserved; their contents were never printed
or copied off the phone. Other sender/device combinations and interrupted-contact /
duplicate-payment device checks remain outstanding.

Validation: seven focused suites passed (107 tests), including coordinator, receipt
matching, keyset validation, fee presentation, existing history layouts, and SQLite
receipt transactions. A separate real SQLite harness also checked metadata preservation,
one History row, invalid amount rejection, gross mismatch, and rollback. TypeScript
and the 36-route structure check passed. This behavior is loaded in the connected
development app; no newer APK was built for these JavaScript changes.

## Initial inspected development APK (diagnostics v1)

[Download the diagnostic APK](https://expo.dev/artifacts/eas/IMVv-ENL6-uJTpShrwDdTnxmBtzgvQ3HnmzI314tzXE.apk)
([EAS build](https://expo.dev/accounts/thehussein01/projects/bey-wallet/builds/5ca74e70-4f03-4bbe-8f5a-e5d25287d986)).
Version 0.2.0, Android build 7, package `com.thehussein01.Bey`.

Inspection of the downloaded APK confirmed compiled diagnostic method bodies in
`classes2.dex` (`Diagnostics.clear/configure/record/report`, native
`getDiagnostics/clearDiagnostics`, and the instrumented application/service methods).
Its compiled manifest is debuggable and registers the HCE service with
`BIND_NFC_SERVICE`, host-APDU metadata, and NDEF Text dispatch. The compiled AID
resource contains `D2760000850101`. Android APK signature verification passed.

- APK SHA-256: `fcaa3afcb61fec9fef754eaff8b1cfab00588b65d6711899a136b7c561591fc7`
- Signing certificate SHA-256: `e153a670503731915d883e9b0f548716b41fb210f05e2b5604bee7cc2aff9f8b`

This is a development APK and needs the development server for its JavaScript UI.
Static inspection alone did not establish NFC interoperability. The subsequent build 8
device result is recorded above.

### USB installation follow-up

The phone's running native bridge initially exposed the payment methods but lacked
`getDiagnostics` and `clearDiagnostics`. Inspection over USB confirmed that its
installed APK differed from the supplied artifact (installed SHA-256:
`62c0687581400a80b07db8dbc7cab60a38bb71455255e237e51ce8c0840655b4`).
Both reported build 7, so the version label did not distinguish them. Restarting
could not resolve the binary mismatch.

Installed the inspected APK using `adb install -r`, without uninstalling or clearing
app data. The phone's installed APK SHA-256 then matched the supplied artifact.
The running native bridge exposed both diagnostic methods, and an actual report call
returned `NFC diagnostics v1 enabled=true` on Android 16. Connected the development
server through USB port forwarding. Physical cashu.me discovery and payment acceptance
were still unverified at that point.

### Shared NDEF AID routing correction (diagnostics v2)

The first tap report contained REQUEST_READY, CONTENT_READY, and ADVERTISING_ON,
with no service activation or APDU. With Bey's request screen open and the phone
unlocked, Android's NFC service dump showed Bey registered for `D2760000850101`
alongside cashu.me, X, and the system NDEF service. No foreground service preference
was set. This demonstrated an AID routing conflict before Bey's APDU transport.
The follow-up build 8 tap successfully read the request and delivered the payment.

The patch now calls Android's `CardEmulation.setPreferredService` on the UI thread
when enabling advertising. It releases that preference when advertising stops or
the activity pauses/destroys. JavaScript remains responsible for restarting NFC
after the existing wallet readiness checks. Android's default wallet is unchanged.
If Android rejects foreground routing, startup fails and advertising is disabled
with the fixed `FOREGROUND_ROUTING` diagnostic category. Payment validation,
durable writes, seeds, and recovery semantics are unchanged.

The production native module is now compiled in the JVM routing regression suite.
The test failed before the correction because enabling the component alone never
selected the foreground service. It passes with the correction and covers stop,
pause/destroy cleanup, a paused/missing activity, and Android rejecting preference.
The Android adapters model these lifecycle and routing API decisions; they do not
replace the physical tap test.

The corrected native module also compiled successfully against Android SDK 36 with
`:react-native-hce:compileDebugJavaWithJavac --offline`. The diagnostics UI unit test
now mocks its native ScrollView container; report actions and copied content remain
covered without loading unrelated native scrolling behavior.

Use `eas build -p android --profile nfc-diagnostics` for this follow-up. This profile
extends the development build and increments the Android build number to make the
installed native version distinguishable from earlier build 7 APKs.

Changed files: the `react-native-hce` patch, `nfcService.ts`, `RequestNfcBadge.tsx`,
the new `NfcDiagnosticsControl.tsx`, `scripts/test-hce.cjs`, the new native
`HceDiscoveryTest.java` and `HceRoutingTest.java`, `nfc-diagnostics.test.tsx`, the
diagnostic build profile in `eas.json`, and this document.
