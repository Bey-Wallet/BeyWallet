# Restore, Nostr and Home acceptance checks

Use an ordinary Android preview build containing these uncommitted changes. An older
installed APK will not include them. A compatible Expo development client can load the
JavaScript and font assets by reloading; compare performance using preview builds,
not development mode. No candidate APK has been built or installed by this task.

Build the candidate with the existing preview profile:

```sh
eas build -p android --profile preview
```

Install that APK on the test device/profile. A new native build is required to verify
that previously embedded obsolete fonts are removed; a JavaScript reload alone does
not remove font resources from an already installed native binary.

## Preparation

1. Record the build/version, device, connected mints and approximate network conditions.
2. Keep a secure recovery backup. Use a spare device/profile or a small test wallet for
   seed-import tests. Do not delete or reset a funded wallet just to measure performance.
3. Compare the old and candidate previews on the same device, mints, network and wallet.
   Record timings locally without seeds, private keys, tokens, proofs or message contents.

## 1. Existing wallet: Recover funds

1. Open Settings → Backup & recovery → Recover funds.
2. Select one connected trusted mint, authorize recovery, and start the scan.
3. Verify that the scan stays active until it settles. A slow mint should show a
   taking-longer message after about 12 seconds, rather than a premature timeout result.
4. Try starting recovery again while it runs. It must not start an overlapping scan.
   Avoid interrupting or replacing the wallet during recovery; the lifecycle guard
   must prevent replacement of the active manager.
5. Check the result: completed, partial, or failed. A partial/failed scan must not claim
   that every keyset was checked. Funds already recovered must remain visible.
6. Repeat with all connected trusted mints. Check that one mint scans at a time, the
   next starts after the previous settles, and controls/navigation remain responsive.
7. After completion, retry once on the same mint. Existing funds/history must not
   duplicate or disappear. An unchanged balance is normal when nothing new is found.
8. Force-close only after scans finish, reopen, and verify that balances/history persist.

## 2. Seed import and backup discovery

1. On the test installation, choose Import wallet and enter the test recovery phrase.
2. If the wallet has mint backups on Nostr, check that those mints are still discovered.
   Pausing the inbox must not prevent essential backup discovery.
3. Complete permissions/setup. Observe recovery progress on Home; the seed-only path
   scans in the background. A backup containing proofs can restore saved funds first
   and skip the automatic deep scan; use Recover funds to exercise that scan explicitly.
4. Measure time from starting the scan to the first recovered balance and to the last
   mint settling. Record skipped/unreachable/partial mints alongside the timing.
5. Check Home, tabs, Settings/back, sheet opening and scrolling during and after recovery.
6. Verify the expected mint balances and known history. A seed-only restore recovers
   deterministic proofs; it cannot recreate every historical payment or discover a
   mint that was never known/backed up. File backups can contain additional history.
7. Reopen after completion and verify persistence. Repeat with a fresh wallet as a
   responsiveness comparison; a fresh-wallet result alone does not establish a fix.

## 3. Nostr catch-up and receiving

1. Use a test identity with previous messages/activity. Start recovery and arrange for
   a test message to arrive while the scan runs.
2. New inbox processing/automatic claims should wait during the recovery queue. A claim
   already submitted before recovery may finish; scanning must wait for it to settle.
3. Once every queued mint settles, the inbox should catch up gradually without a burst
   of overlapping work. Old messages must not duplicate or repeatedly refresh the list.
4. With app lock enabled, background or lock the app during recovery. After recovery,
   catch-up should wait until the app is foregrounded and unlocked. Reopen/unlock and
   check that delayed events are processed.
5. Test an offline/failed receiving attempt with a small test payment. After reconnecting,
   confirm that retry remains possible, payment validation/contact policy still applies,
   and a successful claim appears only once in history.
6. Reconnect relays from Settings after recovery. Check for retained messages and no
   duplicate payment execution. Check responsiveness again after several minutes.

## 4. Home currency pill and hidden balance

1. Choose a fiat currency under Settings → Preferences → Fiat currency.
2. On Home, tap the smaller amount pill: the fiat and sats amounts should swap roles.
   Tap it again to swap back. The saved choice should survive an app restart.
3. Tap the main balance to hide it. Both displayed amounts must be masked and the pill
   must be disabled. Tapping it must not change the saved primary currency.
4. Unhide the balance and confirm that switching works again.
5. Choose None as the fiat currency. Home should show only sats, with no currency pill.
6. Restore a fiat currency, and test with/without the Bitcoin symbol and with a zero
   balance. During price refresh, retain the cached value. With no price available,
   show loading/unavailable rather than an invented zero conversion.
7. Confirm the old Display unit toggle is absent from Preferences; the fiat picker and
   Bitcoin-symbol preference remain. This hide/switch guard applies to Home only.

## 5. Fonts and interaction

- Body/UI copy: Inter Text Regular 400; labels/buttons: Medium 500; headings/balances:
  SemiBold 600. Large values use Inter Display. Only six Inter faces are bundled.
- Inspect `0123469`, `Il1O0`, `$`, `€`, `₹`, `₿` and other selected currency symbols.
  Check equal-width digits, normal unslashed zero, open digits and disambiguation in both families.
- Review dark/light modes, larger system text, Settings rows, navigation titles, text
  inputs, the Home pill and payment screens. Check for clipping and usable touch targets.
- Home's main amount uses −0.5 spacing. Currency-symbol spacing has not been changed.
- Test TalkBack/VoiceOver: the pill should announce the target display currency and its
  disabled state while hidden. Repeat on iOS when available.

## Results to record

| Check                                              | Previous preview | Candidate preview |
| -------------------------------------------------- | ---------------- | ----------------- |
| Seed import: first recovered balance               | Pending          | Pending           |
| Seed import: all mints settled                     | Pending          | Pending           |
| Existing-wallet Recover funds duration             | Pending          | Pending           |
| Responsiveness during recovery                     | Pending          | Pending           |
| Responsiveness during/after Nostr catch-up         | Pending          | Pending           |
| Fresh-wallet comparison                            | Pending          | Pending           |
| Expected balances/history retained                 | Pending          | Pending           |
| Currency pill, hidden state and restart            | Pending          | Pending           |
| Both themes, larger text and native font rendering | Pending          | Pending           |

Record device results in [the performance document](plans/restored-wallet-performance.md).
Automated regression tests verify scheduling and fixtures, not real-device speed.
Long-running exclusivity and wallet-switch scenarios are covered synthetically without
requiring a real mint to hang for ten minutes. Real recovery, payments, biometrics and
NFC remain device checks. No speedup percentage has been measured or promised.
