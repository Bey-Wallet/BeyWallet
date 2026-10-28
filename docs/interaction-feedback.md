# Compact feedback across Bey

The approved toast keeps the user's adjusted 54-point minimum height, tight padding, 32-point
status badge, content-fitting width, contrasting theme, and background-free action button. Ordinary
notices and ongoing-operation notices share `ToastContent` and the same surface props. The dedicated
playground and its route/Settings entry have been removed.

## Presentation rules

| Outcome                                  | Presentation                                                                    |
| ---------------------------------------- | ------------------------------------------------------------------------------- |
| Copy or other small utility confirmation | Compact title, one second                                                       |
| Ordinary informational notice            | Compact title, three seconds                                                    |
| Utility failure                          | Safe title, four seconds; no raw exception or sensitive payload                 |
| Review or unknown outcome                | Five seconds; an essential explanation can say to check History before retrying |
| Passive activity with a real destination | Title and View, six seconds; no amount/message subtitle                         |
| Ongoing operation                        | Existing operation owner; persists until completion or focus/lifetime release   |
| Active payment/recovery outcome          | Existing progress/result screen; no extra success toast                         |
| Field or blocking error                  | Existing local validation or persistent inline message                          |
| Destructive decision                     | Existing confirmation before execution                                          |
| Navigation, selections, routine toggles  | Visible state/touch feedback; intentionally quiet                               |
| Sharing cancellation                     | Quiet; never report delivery based on the share sheet closing                   |

Durations and explicitly essential explanations live in `interactionPresentation.ts`; utility copy
and brief durations live in `interactionCopy.ts`. `useAppToast.showFeedback` applies that policy.
Copy success follows the native clipboard promise. Clipboard contents and native exceptions are
never included in toast text. A failed share does not silently place ecash or another payload on
the clipboard. The user can choose Copy explicitly.

Subtitles require `essentialDescription: true`. They are retained for genuinely important guidance,
such as checking History before retrying an uncertain financial result. Passive payment previews
omit amounts and sender/message details. Their View action is present only when a destination is
available (or when grouped activity can open History). Actions navigate; they do not pay, claim,
retry, or undo a financial operation.

The migration covers existing feedback in Home, history, mint management, Nostr/profile/username,
send/receive/Lightning/on-chain screens, token details, scanners, shared tables and input controls.
It adds missing consistent copy feedback in Settings identity/backups/relays/Lightning address,
conversation sheets, Nostr activity, and Support Bey, plus feedback for previously silent external
link failures. Optimizing a wallet now uses a compact success notice and a safe inline failure.
Onboarding startup failures retain one persistent error rather than a toast plus a modal.

Wallet operations, seed derivation, authentication/reveal gates, native notification permissions,
financial delivery markers, and financial deduplication remain under their existing owners. The
status wording for history checks distinguishes a paid mint quote from issued funds. Checking a
status remains observational and never redeems or retries payment execution.

The full source index is regenerated in `feedback-interactions.jsonl`. Its dispositions are an
automated source index with review guidance, not proof that every native interaction was exercised.

## Manual testing on the real screens

Use an updated development/preview build. There is no test playground to open.

1. **Copy:** copy an invoice, ecash, a mint URL, or a transaction field. Expect one compact success
   toast for about one second. Copy again: each deliberate action should work independently.
2. **Settings:** use Profile & identity → Public key, Nostr & connections → Relays, and Wallet &
   payments → Lightning address. Copy from each. Expect the same one-second toast, without a second
   success paragraph. Secret-key and recovery-phrase copies still require the existing reveal/auth
   steps. Do not share those materials while testing.
3. **Contacts and support:** copy a contact/message from its details sheet, and copy the Support Bey
   address. Expect the same brief confirmation. Copying must not submit a payment.
4. **Share:** cancel a native share sheet. Expect no success toast. If the native share action fails,
   expect a short error; it must not automatically copy a token or URL. Native clipboard/share
   failure injection is covered by automated tests; do not corrupt a real wallet to simulate it.
5. **Passive payment:** with a small test payment, stay on another unlocked screen when Bey detects
   it. Expect one compact title and View only if useful. No amount subtitle. Tap View to inspect the
   actual record. Repeat inside the active receive flow: its result screen owns the outcome.
6. **Pending:** check a pending invoice/request from History. Pending remains pending; a paid mint
   quote is not called received until issued. View opens details. Unknown/reclaim/receipt warnings
   may include the essential instruction to check History before retrying.
7. **Progress:** create/import a disposable wallet or use an existing supported long operation.
   Expect the same compact pill styling with a spinner; it persists while its screen/operation owns
   progress. It must not disappear after one second or block ordinary navigation outside protected
   operations.
8. **Appearance/accessibility:** repeat in light/dark appearance, portrait/landscape, larger device
   text, VoiceOver/TalkBack, and Reduce Motion. Check safe top/side insets, centered short toasts,
   readable status icons, clear announcements, and a usable View target. The action has no fill or
   underline when idle or pressed; keyboard focus remains visible.
9. Confirm **Settings → Advanced** has no Toast playground entry and no playground route exists.

Android/iOS visual alignment, screen-reader timing, native sheet layering, lock/background behavior,
and physical clipboard/share behavior still require device verification. Fully closed-app payment
delivery remains unsupported in this serverless version.

## Validation

- Focused policy, clipboard, utility-screen, payment-state, and operation-owner tests ran first.
- The relevant full regression run passed: **169 suites, 1,337 tests**. It excludes the two previously
  documented baseline harness failures: `header-navigation.test.tsx` (native NFC mock) and
  `mint-url-navigation.test.tsx` (Tamagui mock). Those files were not changed in this update; the
  earlier baseline reproduction is recorded in `feedback-revamp.md`.
- The separate web controls run passed **8 tests**, including custom button colors, transparent
  idle/pressed states, button semantics, and disabled interaction in both themes.
- Typecheck, button check, structure check (**73 routes**), scoped formatting, and whitespace checks passed.
- The regenerated source inventory contains **1,402 records**: 73 routes, 581 controls, 72 sheet/modal
  instances, and 676 asynchronous entrypoints. These are source records, not physical-device passes.

Core presentation files are `src/shared/ui/AppToast.tsx`, `ToastContent.tsx`, `OperationFeedback.tsx`,
`AppToastViewport.tsx`, `AppTextButton.tsx`, and `toastLayout.ts`. Utility policy and copy live in
`src/services/feedback/interactionPresentation.ts`, `interactionCopy.ts`, and
`src/shared/hooks/useAppToast.ts`; passive events remain in `useAppFeedback.ts` and the existing
coordinator. Screen migrations and regression coverage are reflected in the source inventory and Git diff.
