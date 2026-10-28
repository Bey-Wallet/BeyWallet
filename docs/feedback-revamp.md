# Notification and interaction feedback

This version uses local notifications while Bey's process detects activity. It has no push server,
background service, notification badges, marketing alerts, or periodic reminders. Fully closed-app
receiving alerts are **unsupported**.

## Review stages

1. Inventory, explicit copy, framework-independent coordinator, permissions, and preferences.
2. Verified financial outcomes, durable reservations, focus/sheet ownership, and notification actions.
3. Remaining interaction copy, clipboard failures, accessibility, regression checks, and device checks.

The implementation and automated checks are tracked here. Native device acceptance remains pending;
automated notification scheduling tests do not establish background or closed-app receiving capability.

## Interaction inventory

`feedback-interactions.jsonl` is the source-level index: 1,399 entries across 73 routes, 579 controls,
72 sheets/modal instances and 675 async entry points. Regenerate it with
`node scripts/inventory-feedback.cjs`. Each route, actionable JSX control, sheet/modal and async
function has a source reference, trigger, authoritative outcome, existing feedback signals, disposition,
intended owner, copy policy, severity, action and verification status. Internal service functions are
included so caller-owned work is explicitly quiet. This index records presentation decisions; its
`source-indexed` verification status does not claim every path has been exercised on a device.

The following review matrix explains the decisions shared by those entries.

| Interaction / trigger                                     | Authoritative outcome                                         | Disposition / presentation owner                                                                                | Copy / severity / action                                                      | Verification                                           |
| --------------------------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------ |
| Route navigation, back, dismiss, tab selection            | Destination/selected state visible                            | Intentionally quiet; existing touch feedback                                                                    | No success alert                                                              | Navigation and button suites; device pending           |
| Onboarding creation / opening saved wallet                | Wallet initialization resolves                                | Keep progress; inline blocking setup error                                                                      | Safe correction/retry; error                                                  | Creation/onboarding suites                             |
| Seed or backup import                                     | Existing import finishes; recovery handoff retained           | Change duplicate setup/import error to inline; restored balances quiet                                          | Check connection or choose a valid file                                       | Recovery/import suites                                 |
| Consent / username setup                                  | Explicit selection or confirmed registration                  | Keep local field state; no tap success alert                                                                    | Correction beside input                                                       | Existing onboarding/identity suites                    |
| Authentication, revealing secrets                         | Destination authentication succeeds                           | Keep destination protection and hide-on-blur/background                                                         | Local result; cancellation quiet                                              | Protected-value suite; biometric device pending        |
| Copy recovery phrase/private/public key                   | Clipboard write resolves                                      | Change unhandled failures to Settings operation result                                                          | Copied or safe inline failure; never display content in feedback              | Clipboard and Settings suites                          |
| Delete wallet / replace wallet                            | Existing confirmation, authentication and deletion complete   | Keep destructive confirmation and operation result; clear obsolete notification targets                         | Cancel remains quiet                                                          | Backup/deletion suites; device pending                 |
| Ecash preparation / sharing                               | Saved operation produces a token                              | Change wording to “Ecash ready to share”; active screen owns result                                             | Preparation is not delivery                                                   | Ecash confirmation/receipt suites                      |
| Ecash claimed indication                                  | Existing verified proof-state evidence                        | Keep active success screen; detail refresh is intentionally quiet                                               | No claim alert from viewing old details                                       | History/reclaim and confirmation suites                |
| Ecash receive / receive later / offline save              | Existing receive resolves; saved unclaimed token is pending   | Keep result screen; raw receive event quiet                                                                     | Pending is not success; safe next action                                      | Receive/offline suites                                 |
| Lightning payment                                         | Existing Coco operation settles and history confirms PAID     | Change global producer to coordinator; focused quote owner suppresses passive alert                             | Payment sent; pending/unknown never inferred from exception text              | Lightning/payment suites; device pending               |
| Lightning invoice receive                                 | Saved ISSUED history receipt                                  | Change SDK alert to verified quote outcome                                                                      | Payment received; View receipt                                                | Coordinator and mint suites; device pending            |
| On-chain deposit / withdrawal                             | Existing proof/change reconciliation and saved receipt        | Keep active progress/result screens; unknown outcomes stay in their existing pending view                       | No POST acknowledgement described as settlement                               | On-chain receipt suites; device pending                |
| Transfer                                                  | Saved aggregate record is completed                           | Change to one aggregate event; internal mint/melt legs quiet                                                    | Transfer completed; View history                                              | Transfer integration/result suites                     |
| Payment request generation / editing                      | Request version saved                                         | Change duplicate toast+inline error to inline only                                                              | Correction / Retry                                                            | Request-generation suites                              |
| Payment request delivery / receipt check                  | Existing publication/verified receipt state                   | Change redundant status/error toasts to existing local state                                                    | Awaiting receipt is pending; reuse existing operation                         | Payment-request suites                                 |
| Request receipts / screen listeners                       | Verified correlated saved receive                             | Change coordinator ownership by request ID                                                                      | Active request result; no passive duplicate                                   | Request and coordinator suites                         |
| Reclaim                                                   | Existing verified reclaim operation resolves                  | Keep local outcome; sanitize uncertain failure copy                                                             | Check History before another attempt                                          | Reclaim suites                                         |
| NFC reader / send / receive / payment                     | Existing NFC protocol confirms outcome                        | Keep NFC sheet; claim quote/request ownership before submission; block notification navigation during operation | Explicit pending/unconfirmed; retry delivery only through existing controller | NFC suites; native device pending                      |
| Support Bey                                               | Existing authenticated payment result                         | Keep existing payment result, confirmation and safe retries                                                     | No donation success merely for selecting/tapping                              | Supporter suites; device pending                       |
| Nostr auto/manual claim                                   | Existing exact receipt verification and persistence           | Change to one service publisher; global listeners refresh only                                                  | Payment received; View receipt                                                | Nostr claim/receipt suites                             |
| Unknown mint, contact approval, unverified receipt        | Saved incoming item and existing policy/verification result   | Change passive arrival to compact View action; review sheet opens explicitly                                    | Payment needs review; no automatic trust/claim from notification              | Nostr policy/claim and navigation suites               |
| Blocked senders                                           | Existing contact policy                                       | Intentionally quiet for blocked incoming messages                                                               | No preview/notification                                                       | Contact policy/message suites                          |
| Incoming conversation message                             | Authenticated incoming message inserted once                  | Add coordinator message event; focused conversation owns visible state                                          | New message; View conversation; never message text in payload                 | Chat and navigation suites                             |
| Lightning-address discovery/collection                    | Proofs, history and receipt journal transaction commit        | Change to canonical quote event; same transition reserved once                                                  | Payment received; View receipt                                                | Collection and coordinator suites                      |
| Recovery / partial results                                | Existing recovery session reaches results                     | Change per-balance alerts to quiet; one aggregate review event for incomplete results                           | Recovery needs review; View recovery                                          | Recovery suites; background device pending             |
| Backup restore, startup reconciliation, proof maintenance | Existing saved state / maintenance result                     | Intentionally quiet for payment alerts; existing operation owns summary                                         | No restored-balance receipt storm                                             | Recovery, proof and restart suites                     |
| Mint connect/remove/nickname/trust                        | Existing mutation resolves; destructive confirmation retained | Keep operation feedback; sanitize exception text                                                                | Safe error/correction; no protocol exception                                  | Mint suites                                            |
| Proof tools / optimization / offline change               | Existing tool result                                          | Keep existing inline summary/progress                                                                           | Tool-specific counts and safe retries                                         | Proof/change/optimization suites                       |
| Relays, receiving policy, preferences                     | Saved preference or selected state                            | Keep local state; routine selection/toggle quiet                                                                | Inline persistence failure                                                    | Settings/relay/switch suites                           |
| Notification preference / explicit Allow action           | Saved preference; fresh OS permission query                   | Add dedicated screen, private details default, categories and read-only status                                  | System settings when blocked; OS off does not disable app results             | Notification preference/service suites; device pending |
| Return from system Settings                               | AppState becomes active                                       | Add permission recheck; no automatic request                                                                    | Read-only current status                                                      | Service/UI logic; device pending                       |
| Clipboard, paste, QR scan                                 | Native operation/validation resolves                          | Change copy failures to guarded feedback; keep useful scan/validation progress                                  | Safe copy/scan error; no raw exception                                        | Clipboard/scanner/input suites                         |
| Token version or routine input selection                  | Visible chosen version/input                                  | Change routine success toast to quiet                                                                           | Visible state plus touch feedback                                             | Token/input suites                                     |
| Share, export, download, save                             | Native promise resolves or existing file API returns          | Keep existing utility/local operation feedback; cancellation quiet                                              | Failure leaves a safe retry; no payment success                               | Backup/proof/share suites; native share device pending |
| External links / permissions                              | OS handoff or permission result                               | Keep explicit user action and safe failure feedback                                                             | No success alert for opening a link                                           | Link/button suites; device pending                     |
| Offline / retry / cancellation                            | Existing network and domain state                             | Keep inline blockers and retry of existing operation                                                            | Unknown is not failed; canceled pickers/authentication stay quiet             | Offline/payment confirmation suites                    |
| Warm/cold notification tap                                | Opaque stored target resolves after initialization and unlock | Add allowlisted navigation queue; no financial action                                                           | Missing item opens parent list with explanation                               | Navigation tests; device pending                       |

## Ownership and durable delivery

`FeedbackCoordinator` imports neither React nor native modules. It reserves
`wallet + canonical entity type + entity ID + semantic state` before choosing an owner. The SQLite
`bey_feedback_delivery` table is separate from transaction history. SHA-256 identifiers contain no
token, proof, invoice, key or recovery material. Native payloads contain only the opaque delivery ID
and a summary flag. Targets are resolved from local storage for the current wallet.

Screen claims follow navigation focus; global sheet claims follow their visible lifetime. NFC also
claims its quote before submission. Releasing a claim permits a later, different transition to use
passive feedback. Duplicate transitions remain reserved across reconnect/restart/history deletion.
The toast renderer does not infer severity or produce haptics. Publishers/result owners own haptics.

Passive bursts share one compact summary and one haptic. The coordinator chooses an unlocked
foreground toast or a private OS notification, never both. Active owners suppress both global
surfaces. Existing screen progress/results remain available with OS notifications disabled.

Catch-up/import/recovery maintenance reserves markers without announcing restored funds. Timestamp
classification is deliberately conservative: old relay events and old quote/receipt records are
not presented as fresh arrivals after startup. History remains authoritative if delivery fails.

## Automated validation

Focused coordinator, notification service, preference, clipboard, navigation, and real SQLite
restart/history-deletion tests cover reservation races, private copy, categories, disabled/revoked
permissions, native prompt failure, previous authentication guard restoration, warm/cold callbacks,
deleted targets, wallet changes, and guarded navigation. Existing financial/security regression
suites verify that execution, proof validation and recovery behavior are retained.

Validation results:

- Focused checks ran before the broad regression run, including real SQLite restart/deletion,
  duplicate SDK/Nostr/collection/screen signals, owner focus/blur, late ownership, one outcome haptic,
  Transfer quote collisions across mints, native permission errors/concurrent requests, and paste/copy
  failures. All pass.
- `yarn typecheck`: passed.
- `yarn check:structure`: passed, 73 routes.
- `yarn check:buttons`: passed.
- `yarn test:web:buttons`: passed, 6 tests.
- Scoped Prettier checks and `git diff --check`: passed.
- Full relevant regression run: **165 suites, 1,313 tests passed** using
  `yarn test:ci --runInBand --silent --testPathIgnorePatterns 'header-navigation.test.tsx|mint-url-navigation.test.tsx'`.
- The ordinary full run also exposed two unrelated baseline suites. Both were reproduced on the
  unchanged HEAD commit in a temporary isolated checkout, then that checkout was removed:
  `header-navigation.test.tsx` lacks its native NFC mock (`NativeEventEmitter` fails to load), and
  `mint-url-navigation.test.tsx` lacks Tamagui's `usePropsAndStyle` mock. Their source was left unchanged.

The manual walkthrough is [notification-manual-testing.md](notification-manual-testing.md). It includes
preview-build installation, exact Settings paths, send/receive steps, private lock-screen expectations,
permission revocation, existing-alert cold starts, missing items, reconnect and recovery checks.

The complete file list is [feedback-changed-files.md](feedback-changed-files.md).

## Device checklist

No Android device/emulator was connected (`adb devices` returned an empty list). iOS preview builds
cannot be exercised from this Windows workspace. Every item below is **pending on both platforms**.

- Ordinary preview build: foreground receipt while another screen is focused produces one toast and
  one haptic; active payment/request/result produces one local result and no global duplicate.
- Background and locked, process still running: private copy and one notification if an event is
  actually detected; no proofs, tokens, invoices, keys, sender text or recovery content in payloads.
- Details opt-in, hidden balances and wallet lock: verify previews are redacted and existing foreground
  previews disappear on lock/hide; test VoiceOver/TalkBack announcements and reduced motion.
- Fresh Android channel has normal importance and a clear name; upgraded channel preserves OS/user
  settings. Verify foreground OS banners stay suppressed when Bey presents the event itself.
- Permission allowed/denied/revoked/unavailable, interrupted/failed native prompt, explicit retry, and
  return from system Settings: no delivery-time permission prompt; authentication guard restored.
- Multiple receipts/messages and relay reconnection: one summary, no historical replay or alert storm.
- Warm/cold notification tap, repeated callback, missing transaction/conversation/inbox item, wallet
  switch/delete, and a tap while payment/recovery/NFC/Settings work is protected: safe queued navigation.
- NFC/biometrics/share/download/save/clipboard native failures and cancellations: preserve operation,
  leave a safe next action and produce no false financial success.
- Restart and deleting transaction history: no repeated payment alert for an already reserved event.
- Force-stop / fully closed-app receiving: **unsupported**, not a device-test pass condition.
