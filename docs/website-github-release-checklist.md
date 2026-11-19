# Website and GitHub APK release checklist

Scope: update the Android APK distributed through bey.cash and GitHub. Play Store
submission and AAB generation are separate work.

## Current evidence

- [x] bey.cash already distributes Bey, as confirmed by the developer.
- [x] The current changes are committed on `feat/release-readiness-polish`.
- [x] At checklist preparation, the branch is five commits ahead of local `main`,
      with a clean working tree and HEAD `84901d2`.
- [x] Diagnostics and affected wallet regression checks passed: 83 focused tests.
- [x] Lightning receipt reconciliation checks passed: 41 focused tests.
- [x] TypeScript, scoped formatting and structure checks passed during the recent work.
- [x] Earlier wallet-safety and recovery checks were reported complete by the developer.
- [ ] Latest standalone APK built and tested. The preview build was stopped during compression.
- [ ] Latest outgoing Lightning background/foreground fix confirmed on a phone.
- [ ] Outstanding security review completed for this release.

Focused test results and earlier device checks do not establish acceptance of a
new APK. Record the exact artifact tested below.

## 1. Freeze the release candidate

- [ ] Review the five commits, merge approved work into `main` with a merge message,
      and push it when authorized. Confirm the working tree is clean.
- [ ] Choose the release version and Android version code. Check the remotely
      managed EAS version and ensure the candidate updates the currently published APK.
- [ ] Confirm the Android package and signing certificate match the existing release.
- [ ] Choose the build profile and update channel intentionally. The existing
      `production` profile builds an APK on the `production` channel; `preview`
      builds an APK on the `preview` channel. Neither is a development-client profile.
- [ ] Run the release checks against the frozen source: type checking, tests,
      structure and shared-button validation. Investigate failures before publishing.

```powershell
rtk yarn validate
```

## 2. Build and identify the APK

- [ ] Build the signed candidate using the chosen EAS profile. Check its environment
      settings; public downloads should use the intended public update channel.
- [ ] Record the build URL, source commit, app version, version code and APK checksum.
- [ ] Install the downloaded candidate with Metro disconnected. If a different
      profile or a new build is produced afterward, test that exact artifact too.
- [ ] Verify Diagnostics identifies the intended build/runtime. Check whether an
      OTA update was loaded so acceptance is tied to the code actually running.

Example for the existing production APK profile:

```powershell
rtk eas build --platform android --profile production
```

| Release evidence                       | Value   |
| -------------------------------------- | ------- |
| Source commit / release tag            | Pending |
| Version / Android version code         | Pending |
| EAS build URL / profile / channel      | Pending |
| Installed update ID or embedded bundle | Pending |
| APK filename / SHA-256                 | Pending |
| Test phone / Android version / date    | Pending |

## 3. Test the exact candidate on Android

- [ ] Install cleanly, cold-start, force-close/reopen, lock/unlock, and verify biometric
      cancellation and retry. Confirm no Metro or developer-client dependency.
- [ ] If replacing an existing public installation, update it without uninstalling
      and confirm its wallet, balances and History remain available.
- [ ] Send and receive small Lightning and ecash payments; test a mint-to-mint
      transfer. Confirm settlement, fees and balances agree with History.
- [ ] During a Lightning send, switch apps or lock the phone, then return. Confirm
      the original receipt reconciles, with one submission and one balance effect.
- [ ] Repeat pending-payment checks with a network interruption. Uncertainty must
      stay pending/unresolved, with a usable check/recovery path.
- [ ] Check receiving while backgrounded, pending ecash claim/reclaim, transfer
      reconciliation and NFC interruption/resume if these are advertised in this release.
- [ ] Smoke-test seed recovery and export/file restore on a clean test installation.
      Confirm the new wallet reports encrypted storage. Use test funds and retain
      access to the test wallet until reconciliation is complete.
- [ ] Check onboarding custody/recovery wording, a single risk acknowledgment for
      import, layout in both themes and large system text.
- [ ] Check loading, empty, error and retry states. Verify support links, diagnostics
      device fields, copy/share, and the exact report preview on the phone.

Detailed acceptance references:
[payment UI](payment-ui-verification.md),
[async feedback](testing/async-feedback-checklist.md),
[diagnostic reports](diagnostic-reports.md).

## 4. Close security and privacy review

- [ ] Review seed/private-key storage, database encryption and destination-level
      biometric protection. Verify sensitive screens hide their contents when leaving the app.
- [ ] Inspect release logs, diagnostics, crash reporting and any analytics for wallet
      secrets, proofs, tokens, invoices, balances and contact identifiers.
- [ ] Verify malformed invoices, QR payloads, mint URLs and deep links are rejected safely.
- [ ] Review dependency findings and the APK's actual merged permissions; remove
      unnecessary permissions before rebuilding. Check production debug features
      and packaged files for credentials or development-only functionality.
- [ ] Review clipboard and recent-app previews for sensitive content. Confirm reports
      are user-initiated, show their contents first and disclose that GitHub issues are public.
- [ ] Confirm mint custody, redemption risk, recovery limitations and beta status
      are explained consistently in the app and release notes.

Use [security logging rules](security-logging.md) as a reference. Record review
findings and their resolution; do not mark the review complete from test counts alone.

## 5. Publish the approved artifact

- [ ] Create a versioned source tag and GitHub release for the approved source.
- [ ] Attach the exact signed, tested APK and its SHA-256 checksum. Keep signing
      keys and service credentials private.
- [ ] Write release notes covering changes, known limitations, beta status and
      upgrade instructions. Link Help/support and describe mint custody clearly.
- [ ] Update bey.cash to the same GitHub release/artifact, version and checksum.
      Avoid leaving users with different binaries under the same version label.
- [ ] Download through the public website on a phone. Check the checksum, installation,
      displayed version and support/reporting links using that download.
- [ ] Keep the previous release available and document the response to a bad release.
      Do not assume that downgrading an APK preserves compatibility with newer wallet data.
- [ ] After publishing, monitor support reports and reproducible payment/recovery
      problems before expanding promotion. Preserve the release's build/source evidence.

For a downloaded APK:

```powershell
rtk powershell -NoProfile -Command "Get-FileHash -Algorithm SHA256 -LiteralPath '.\Bey-Wallet-vX.Y.Z.apk'"
```

## Release decision

- [ ] The exact candidate passed device acceptance, security findings are resolved,
      and the publication evidence above is recorded.
- [ ] The developer approves publishing this version to bey.cash and GitHub.
