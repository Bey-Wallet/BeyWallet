# Animated ecash QR verification

Pending ecash screens keep QR frame state inside `AnimatedTokenQRCode`. Multipart
playback uses 150-byte fragments at a 100 ms interval. The existing UR bytes
envelope and full token payload are preserved; uppercase UR frames allow more
compact QR alphanumeric encoding. Frames stop on navigation blur, app background,
token removal, errors, and unmount. Single-part QRs do not run an animation timer.

Outgoing web publishing and the eCash Link send method have been removed. System
sharing sends `cashu:<token>` directly. Copy and NFC retain the original token.
Previously shared web links remain redeemable through the existing receive path.

## Automated checks

```sh
yarn test:ci --runInBand --runTestsByPath tests/unit/animated-token-qr.test.tsx tests/unit/ecash-confirmation-flow.test.tsx tests/unit/receive-offline-save.test.tsx tests/unit/nfc-entry-points.test.ts
yarn typecheck
yarn check:structure
```

The QR tests verify frame timing, isolation from header renders, token replacement,
pause/resume, cleanup, errors, single-part playback, the remaining send methods,
and unchanged token content in copy, NFC, and system sharing.

Implementation validation also round-tripped synthetic V3/V4 tokens with 1, 10,
and 64 proofs through the installed UR encoder/decoder, including dropped frames
and duplicate scans. All six recovered the exact original token. Uppercase frames
reduced representative QR matrices from 73×73 to 61×61 modules at the same error
correction level. Desktop checks do not establish Android frame timing.

## Android device checks still required

Use a disposable test wallet and a release build to assess smoothness.

- Create small and large ecash sends, including V3, V4, and P2PK tokens. Scan them
  with Bey and native Cashu on another device, including in airplane mode. Confirm
  the received token amount and lock information match. Do not record tokens or
  proof secrets; record only aggregate timing and scan success.
- Compare frame cadence and button response with native Cashu on the same device.
  Use Android/React profiling to confirm that QR frames do not update the header
  or payment details and to measure any remaining SVG render cost.
- Background/resume, open another screen, return from History, and close/reopen a
  pending send. Verify playback resumes without competing timers or stale frames.
- Check the Share / Send sheet offers system share, NFC, and token copy, with no
  web publishing option. Verify system share/cancel, NFC send/cancel, copy, status
  refresh, claim, and reclaim. Confirm authentication and pending operation guards.
- Check a previously shared web link can still be redeemed. Verify the send method
  list has no eCash Link option and old `mode=link` navigation falls back to Standard.
- Check QR quiet margins, scaling, and light/dark mode on narrow devices.
