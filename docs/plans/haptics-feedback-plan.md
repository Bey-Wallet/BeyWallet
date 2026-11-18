# Bey haptic feedback plan

Status: implementation authorized and implemented on `plan/haptics-feedback`, based on
main at `6898ed2`. Written on 2026-11-18. Automated verification and remaining device
acceptance are recorded in [the implementation results](../haptics.md).

## Product decision

Keep short, optional haptics for meaningful interaction and verified outcomes. Remove
vibration from routine navigation, discovery, loading and automatic retries. The intended
feel is quiet and precise: a subtle selection tick, a light acknowledgment, and a clearly
different completion signal when a wallet operation has actually completed.

Haptics supplement text, icons and accessible announcements. They never establish payment
status, authorize an action, reveal a balance, or replace a warning or confirmation.

Default the application preference to enabled, while respecting the operating system and
supported hardware. A user who disables feedback must be able to use every flow normally.
Do not add a permission prompt or onboarding step.

## Evidence and limits

- [Android haptic principles](https://developer.android.com/develop/ui/views/haptics/haptics-principles)
  recommend restrained use, predefined effects and silence over poor, buzzy feedback.
- [Android feedback APIs](https://developer.android.com/develop/ui/views/haptics/haptic-feedback)
  prefer action-oriented view feedback. Do not force effects past system preferences.
- [Apple haptic guidance](https://developer.apple.com/design/human-interface-guidelines/playing-haptics)
  recommends short, consistent, optional patterns with meanings aligned to the action.
- [BlueWallet's helper](https://github.com/BlueWallet/BlueWallet/blob/master/blue_modules/hapticFeedback.ts)
  separates selection and outcome effects, respects Android system settings and checks low
  power mode. Its vibration fallback is not a recommendation to copy that fallback into Bey.
- [MetaMask release notes](https://github.com/MetaMask/metamask-mobile/releases) document haptics
  for specific bottom-sheet interactions. This is a targeted example, not evidence that every
  navigation action benefits from feedback or that haptics cause adoption.

These sources inform the design; physical feel still requires device testing. No claim is
made that every wallet uses the same patterns or that equal API names feel equal on devices.

## Current code boundaries

The source inspection found direct Expo haptic calls distributed across tabs, Home, mint
discovery, payment flows, scanning, onboarding, identity screens, settings and authentication.
Some are appropriate outcomes; many are ordinary taps, copying, refresh or navigation.
Create a complete call-site inventory before implementation rather than assuming the files
below are the entire migration scope.

Important existing owners:

- `src/services/feedback/feedbackCoordinator.ts` already reserves durable feedback markers,
  assigns foreground flow ownership, groups events and suppresses restored/catch-up activity.
- `src/shared/hooks/useAppFeedback.ts` presents global activity and emits native haptics. Its
  current severity-to-warning mapping must not make informational events feel like warnings.
- `src/shared/hooks/useResultHaptic.ts` handles local outcomes and gates background/locked
  feedback, but its local set is not a replacement for durable outcome ownership.
- `src/shared/ui/NumericKeypad.tsx` has light/medium feedback on amount entry and deletion.
- `src/shared/ui/LockOverlay.tsx` adds feedback around the OS authentication prompt.
- `src/features/payments/ScannerScreen.tsx` and onboarding validation use success patterns for
  some accepted input. Those must not be confused with completed financial operations.
- `src/features/nfc/NfcSheetHost.tsx` uses result feedback; native NFC may also produce a sound
  or vibration. Audit the existing native flags and actual device behavior before adding an
  application acknowledgment.
- `src/features/mints/AddMintScreen.tsx` vibrates on refresh, pagination and other taps.
  `MintsScreen.tsx` now provides bulk management and needs one aggregate completion event.

Do not change wallet derivation, receipts, proof persistence, retry semantics, authentication,
notifications or the current spinner to implement haptics. Home's connected-mint card styling,
Allo typography and control geometry remain unchanged.

## Intensity and platform specification

Intensity here is a relative design tier, not a motor amplitude or a user-facing percentage.
Stock OS patterns do not provide a reliable cross-device strength scale. Do not promise a
specific pulse duration, identical physical force or custom amplitude using these APIs.

| Semantic effect           | Perceived target                                     | iOS candidate                | Android candidate                        |
| ------------------------- | ---------------------------------------------------- | ---------------------------- | ---------------------------------------- |
| Selection                 | Very subtle, short tick                              | `selectionAsync()`           | `Segment_Tick`                           |
| Keypad entry              | Lightest useful tick                                 | `selectionAsync()`           | `Keyboard_Tap`                           |
| Accepted scan/input       | Light acknowledgment, distinct from money completion | `impactAsync(Light)`         | Selection tick, subject to device review |
| Contextual long press     | One light acknowledgment when the action activates   | `impactAsync(Light)`         | `Long_Press`                             |
| Verified completion       | Standard OS completion pattern                       | `notificationAsync(Success)` | `Confirm`                                |
| Explicit rejected action  | Standard OS rejection, once                          | `notificationAsync(Error)`   | `Reject`                                 |
| Immediate review required | Restrained warning, only when actionable             | `notificationAsync(Warning)` | `Reject`, distinguished by visible copy  |
| Everything else           | Silent                                               | No call                      | No call                                  |

Android candidates use `performAndroidHapticsAsync` from the already installed `expo-haptics`.
The installed implementation delegates this API to `View.performHapticFeedback`; its current
`impactAsync`, `selectionAsync` and `notificationAsync` Android implementations use vibrator
waveforms instead. Prefer the native view path when migrating Android interactions.

Before implementation, verify each enum's mapping and Android-version fallback in the
installed native source. Do not substitute an unrelated semantic pattern just to obtain a
buzz. Unsupported feedback should quietly do nothing; never fall back to React Native
`Vibration`, repeated pulses, heavy impacts or a custom waveform.

No intensity slider, custom pattern editor, Light/Medium/Heavy settings menu or new dependency
is proposed. Tune semantic choices on devices, not through arbitrary numeric strength values.
No new native build should be necessary if the existing dev client includes these APIs;
verify availability and ask before any dependency/native change.

## Interaction policy

| Interaction                                                             | Policy and exact trigger                                                                                                                |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Tabs, Back, Close, opening a screen or sheet                            | Silent; visual pressed states remain                                                                                                    |
| Discovery results, Load more, scrolling and refresh                     | Silent, including manual refresh                                                                                                        |
| Mint/payment-currency selection                                         | One selection tick only after the value changes                                                                                         |
| Home balance hide/reveal or currency switch                             | At most one subtle state-change tick; no medium impact                                                                                  |
| Single checkbox or preference switch                                    | One selection tick after a real change; no extra tick if the native control already supplies it                                         |
| Select all / clear selection                                            | One tick for the whole action, not one per row                                                                                          |
| Tapping a disabled/protected mint                                       | Silent; retain the visible protection reason                                                                                            |
| QR scan                                                                 | One light acknowledgment after supported payload validation, not on every camera frame or prefix detection                              |
| NFC read                                                                | Avoid duplicating system feedback; application acknowledgment only where native feedback is absent and the validated input is accepted  |
| Copy address, invoice or receipt                                        | Optional light acknowledgment after clipboard success; never the payment-success pattern                                                |
| Seed/private-key copying                                                | Prefer silent; keep security warnings and authenticated access unchanged                                                                |
| Amount keypad                                                           | One subtle tick per accepted press; backspace uses the same tier, not medium/heavy feedback                                             |
| Paste, autofill, programmatic amount changes                            | Silent                                                                                                                                  |
| Long-press action                                                       | One acknowledgment when the action activates; no additional release pulse                                                               |
| Send/receive/transfer verified complete                                 | One completion pattern after the existing persisted receipt establishes completion                                                      |
| Cashu prepared, offline offer saved, invoice created or request sent    | No financial-success pattern; retain accurate visual state                                                                              |
| On-chain broadcast or pending confirmation                              | Silent for financial completion until the existing flow verifies its completed state                                                    |
| Pending payment, issuance delay, network retry or refresh failure       | Silent; uncertainty must not feel like a definite failed payment                                                                        |
| Definitive user-visible operation failure                               | One rejection pattern on the original live attempt                                                                                      |
| Cancel/back/dismiss/authentication cancelled                            | Silent                                                                                                                                  |
| OS biometrics/passcode result                                           | OS feedback only; remove Bey's extra prompt/result pulses                                                                               |
| One mint added or disconnected                                          | One completion pattern after the change is saved, never on the opening tap                                                              |
| Bulk removal                                                            | One aggregate completion; partial removal uses one review warning with accurate removed/kept text, never both success and error pulses  |
| Historical receipt opened, app resumed or restored history synchronized | Silent                                                                                                                                  |
| Recovery/backup work in progress                                        | Silent; never pulse for every mint, proof, retry or progress increment                                                                  |
| Explicit backup/recovery flow finishes                                  | At most one completion only when the existing flow verifies completion; restored funds must not trigger individual payment celebrations |
| Background notifications                                                | OS notification-channel behavior only; no additional application haptic call                                                            |

Do not treat toast severity alone as a haptic instruction. An informational toast, chat message,
routine warning or failed observation is not automatically an actionable rejection.

## Preference and accessibility UX

Updated at the user's request: show Haptic feedback and Expanded Home as inline `AppSwitch`
rows directly in Settings → Appearance. Remove their standalone screens and routes. No
preview button or extra confirmation dialog is needed.

Persist `hapticsEnabled` in the existing encrypted settings repository. Missing preference
defaults to enabled; explicit disabled is preserved on restart. Invalid values should fail
quietly rather than force feedback on. Suppress application haptics before settings hydration.
Turning off takes effect immediately, clears pending effects and gives no final off vibration.
If persistence fails, retain the current-session off choice and show a brief retryable error;
do not silently claim that the preference was saved.

Keep the backup-file format and recovery semantics unchanged. Check the existing settings
reset/restore lifecycle; do not claim that exported backups preserve this new preference unless
the actual format does. Changing a preference must not require seed re-derivation or a database
re-encryption/migration.

Respect OS vibration settings and unsupported hardware. Reduced Motion is not the same as
Haptics Off: suppress optional/decorative ticks under reduced motion while allowing meaningful
completion feedback when haptics remain enabled. Do not disable feedback solely because a
screen reader is active. Verify TalkBack/VoiceOver, larger text and touch targets separately.

## Ownership, duplicate suppression and timing

Preserve the existing FeedbackCoordinator's durable reservation, live-origin checks and
foreground owner selection. An active receipt screen and global feedback must never both
vibrate for the same financial outcome. Audit every owner callback, local result hook and
global presenter before replacing them; there is no proven duplicate on every current path.

Use existing operation/receipt identifiers internally for outcome ownership. Never log seeds,
tokens, proofs, invoices or private keys, and never encode amount or identity in a pattern.
Do not create a parallel payment-outcome ledger solely for haptics.

Proposed tuning limits, to be confirmed on devices:

- Keypad ticks: at most one per 60 ms; held backspace must not produce continuous buzzing.
- Selection ticks: at most one per 100 ms; drop intermediate bursts rather than queueing them.
- Scan acknowledgments: one per accepted candidate/read session. Repeated frames and animated
  QR fragments are silent. Reset only for an explicit new scan session/candidate decision.
- Outcomes: one per verified operation/outcome state, across rerenders, remounts and relayed
  duplicate events. Use existing grouped activity for simultaneous receipts; never vibrate
  once for every restored or background-discovered transaction.
- Important outcomes must not be discarded because a selection tick just played. Drop queued
  low-priority work rather than delaying a completion to finish decorative feedback. Exact
  native interruption behavior remains device-controlled.

All application effects require active foreground state, hydrated settings, an enabled
preference, an unlocked wallet where applicable, and the current wallet generation. Suppressed
events are not replayed on unlock, foreground return or enabling haptics. Clear short-lived
dedup/rate-limit state on wallet replacement; bound any interaction cache.

Never await a native haptic before submitting/persisting a wallet operation, navigating or
rendering a result. Catch native failures inside the adapter. A rejected or unavailable haptic
API must not reject a payment, change its status or produce an error toast.

## Implementation boundaries and sequence

1. Inventory all direct `Haptics`/`Vibration` imports and result-hook callers. Classify each as
   remove, selection, acknowledgment, verified outcome, or OS-owned. Include Expo routes,
   shared controls, POS, NFC, onboarding, Nostr, recovery and retained BUI previews. Do not
   globally make every button or pressable vibrate.
2. Add a small pure policy under `src/services/feedback/` and a native adapter under
   `src/services/platform/`. Use the existing Expo package. Keep wallet-state gating outside
   the native leaf through supplied state/readers so it does not introduce lifecycle cycles.
3. Add the persistent preference as an inline Appearance toggle. Follow existing Tamagui
   tokens, `AppSwitch` and minimum 48-point targets.
   Do not rename/reorganize existing settings categories as part of this task.
4. Integrate the adapter with FeedbackCoordinator presentation and `useResultHaptic`. Require
   stable outcome ownership where financial feedback is emitted; remove redundant screen or
   global pulses while keeping their visual errors/results.
5. Migrate controls and screens in small groups: payment outcomes and QR/NFC first; keypad and
   selections second; mint management and utility actions third. Remove routine navigation,
   discovery/loading and duplicate biometric calls. Verify every migrated group before moving
   on. Keep existing monetary behavior and receipt semantics unchanged.
6. Audit remaining imports. Route files remain thin; meaningful native calls belong behind the
   adapter. Remove unused haptic imports. No direct vibrator fallback or new permission.
7. Complete device tuning and record results in a focused acceptance document. Commit behavior
   changes separately from the planning document; do not merge until checks and device results
   are reviewed. Any dependency or native-module change needs separate approval.

## Verification and acceptance

Unit/regression checks must cover:

- Every semantic event's platform mapping and every intentionally silent event.
- Haptics Off, unhydrated settings, background/locked state and stale wallet generations
  suppress all application effects. Re-enabling/resuming does not replay skipped effects.
- OS/API unavailability, synchronous throws and rejected native promises cannot affect wallet
  outcomes. Test web/unsupported platforms as no-ops.
- One stable outcome across screen/global presentation, duplicate events, rerenders, remounts
  and receipt reopening. Historical/recovery events remain silent.
- Prepared ecash, PAID-but-not-issued mint quotes, ambiguous melts, on-chain pending states and
  polling errors never trigger financial-success/error patterns prematurely.
- Single checkbox, Select all, partial bulk removal, held backspace and repeated scan frames
  obey their aggregate/rate-limit rules.
- Settings default, persistence, failed saves, restart, reset/restore and immediate disable.
- Visual/accessibility feedback remains complete with every native haptic mocked away.

Run narrow tests first, then TypeScript, relevant payment/feedback tests, formatting and the
route-structure check after adding the settings route. Re-run the real wallet/payment tests;
pattern snapshots alone do not verify safe ownership.

Device acceptance must include an Android Pixel-class device, a Samsung-class device and a
lower-end motor if available; include iPhone before claiming iOS feel is approved. Check OS
versions relevant to the chosen Android constants. Mark unavailable devices as unverified.

For each available device, check system haptics off/on, app toggle off/on, reduced motion,
screen reader, battery-saving conditions, active camera, OS authentication, background/resume
and unsupported effects. Test QR/NFC and real small-value payment completion, ambiguity and
retry. Verify native NFC/keyboard/biometric feedback is not duplicated.

Pass criteria: ticks feel brief rather than buzzy; routine browsing stays quiet; accepted input
feels different from verified completion; one action produces one intended acknowledgment;
no repeated motor activity during waiting; and disabled feedback leaves an equally usable app.
Measure feel on hardware rather than claiming fixed millisecond/amplitude compliance.

## Completion boundary

This plan is complete when its policy, mappings, ownership, settings behavior, migration order
and verification requirements are reviewable. Implementation is complete only after tests and
recorded device checks support the chosen effects. Device acceptance remains separate from
the local implementation and automated checks.
