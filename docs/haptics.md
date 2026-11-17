# Haptic feedback

Implemented on `plan/haptics-feedback` on 2026-11-18. Hardware acceptance is pending.
The [approved plan](plans/haptics-feedback-plan.md) records the rationale and references.

## Result

The audit classified 200 existing direct native calls. Native haptics now live only in
`src/services/platform/hapticService.ts`; feature code requests semantic feedback there.
No dependencies, permissions, native configuration or wallet execution rules changed.

| Interaction                                                             | Feedback                                                        |
| ----------------------------------------------------------------------- | --------------------------------------------------------------- |
| Ordinary navigation, tabs, Back/Close, sheets opening/closing           | Silent                                                          |
| Scrolling, refresh, discovery, loading, retries and polling             | Silent                                                          |
| Changed amount digits and backspace                                     | Light keypad tick, at most once per 60 ms                       |
| Changed mint, mode, currency, checkbox, radio or preference             | Subtle selection tick, at most once per 100 ms                  |
| Supported payment QR accepted by the universal resolver                 | Light acknowledgment, not a payment success                     |
| Incomplete animated QR fragments or unvalidated contextual scan results | Silent                                                          |
| Successful ordinary copies                                              | Light acknowledgment where the owning control confirms the copy |
| Recovery phrase/private-key entry or copying                            | Silent                                                          |
| Persisted live received/sent/transfer outcome                           | One coordinator-owned completion                                |
| Prepared token, created request/invoice, pending or uncertain payment   | Silent                                                          |
| Incoming payment/recovery requiring review                              | Review feedback through durable delivery                        |
| Mint connected/removed                                                  | Completion after the operation succeeds                         |
| Bulk removal                                                            | One completion, or one review if some mints were kept           |
| OS authentication                                                       | OS feedback only                                                |

An explicit connection rejected for an invalid mint URL gets one rejection before any wallet
operation. Network or settlement uncertainty stays silent.

Selection coverage includes previously silent Settings choices, recovery mint checkboxes,
connected-mint checkboxes and Select all, trust acknowledgments, P2PK/legacy amount toggles,
reclaim presets and the shared BUI selection controls. Already-selected radio options,
blocked mint rows and keypad no-ops do not request ticks. No global button-press vibration
was introduced. Setup stays quiet until wallet preferences have hydrated.

## Preference and platform behavior

Settings → Appearance shows Haptic feedback and Expanded Home as inline AppSwitch rows.
Their separate screens have been removed at the user's request. New wallets default to On
for haptic feedback. Explicit Off persists; invalid stored values
fail closed. Disabling is immediate even if saving fails, with a visible setting error.
Enabling takes effect after saving. There is no preview button, intensity slider or percentage claim.

Android uses Expo's existing `performAndroidHapticsAsync`, which calls the view's
`performHapticFeedback` without flags overriding system preferences. Selection/acknowledgment
use Segment Tick, keypad uses Keyboard Tap, completion uses Confirm, review/rejection use
Reject. iOS uses selection, Light impact and success/warning/error notifications. Unsupported
platforms and native failures are no-ops; there is no waveform/vibration fallback.

Every effect checks hydrated settings, the enabled preference, foreground and unlock state.
Reduced Motion suppresses optional ticks and acknowledgments, preserving meaningful outcomes.
Ticks are dropped rather than queued; completion is not delayed by a recent tick.

The existing feedback coordinator retains its durable reservation, wallet-generation and
ownership rules. Both screen-owned and global financial haptics pass through that single
delivery point; result components no longer vibrate on mount. Eligibility is captured before
reservation, and preference/auth/lifecycle changes invalidate queued haptics. Resuming,
unlocking or enabling does not replay skipped feedback. Historical and suppressed recovery
events remain silent. Haptics never establish settlement or alter payment execution.

NFC keeps the existing reader flags (`0x100`, no platform sounds) and adds no application
acknowledgment on tag detection. Completion comes from durable wallet feedback rather than
the sheet's visual state. Native keyboard/NFC/auth feel still requires hardware verification.

## Verification

Automated checks cover policy gates, rate limits, platform mappings, native failures,
preference persistence/failure, durable ownership/deduplication and queued eligibility.
Interaction checks cover keypad no-ops and disabled state, bulk mint selection/removal,
scanner routing and existing payment/NFC flows. Final local results are recorded below.

- Focused regression run: **22 suites, 257 tests passed**, including policy, settings,
  coordinator ownership, keypad, scanner, connected mints, NFC, P2PK and payment feedback.
- TypeScript, 94-route structure check, shared-button check, changed-file Prettier check
  and `git diff --check`: passed.
- Final full-suite run: **254 suites / 2,228 tests passed; 11 suites / 30 tests failed**.
  Every failing assertion was also reproduced on unchanged main; no new failing assertions
  were found in the comparison. The existing BUI timing failure did not recur in this run.
- Existing failures were reproduced on unchanged main (`6898ed2`) in an isolated temporary
  checkout. They affect pending top-ups, request-generation layout, action-selector layout,
  BUI card timing, payment-stage layout, on-chain history layout, header navigation, NFC
  entry-point source assertions, root startup, SQLCipher storage mocks, mint contacts and
  blocked-people UI mocks. Those unrelated behaviors were not changed for this task.

The keypad also ignores a repeated decimal point, so rejected input produces neither an
amount change nor a tick. Automated tests do not establish motor strength or real NFC feel.

## Main implementation files

- `src/services/feedback/hapticPolicy.ts`: state gates, reduced motion and tick rate limits.
- `src/services/platform/hapticService.ts`: native mappings and semantic event API.
- `src/services/feedback/feedbackCoordinator.ts`: durable financial delivery and eligibility.
- `src/shared/hooks/useAppFeedback.ts`: root state readers and lifecycle invalidation.
- `src/state/settingsStore.ts` and `src/features/settings/SettingsCategoryScreen.tsx`:
  persisted preferences and inline Appearance toggles.
- Shared keypad, selection controls, mint/mode selectors, settings rows and owning feature
  handlers: meaningful feedback added; direct native effects removed across navigation,
  payment, history, Nostr and onboarding components.
- The obsolete `useResultHaptic` hook was removed with its component calls and test mocks.
- `scripts/check-structure.mjs`: records removal of the two standalone settings routes.

## Device checks remaining

- On Android: app On/Off, system haptics On/Off, keypad, backspace, mint/mode selections,
  Settings toggles, Select all and partial bulk removal.
- Scan a valid static/animated payment QR: one light acknowledgment; no fragment buzzing.
- Complete a small Lightning/ecash payment: one completion; pending/uncertain/retry states
  stay quiet. Reopen History and the finished NFC sheet: no repeat completion.
- Background/lock/disable during an operation, then resume/unlock/enable: no replay.
- Check reduced motion, screen reader, battery saver and unsupported effects. Visual
  feedback must remain sufficient with all haptics disabled.
- Check Samsung and another Android motor if available, and iPhone before approving iOS feel.

These changes use the already-installed Expo module. No new EAS development build is
required solely for this JavaScript change.
