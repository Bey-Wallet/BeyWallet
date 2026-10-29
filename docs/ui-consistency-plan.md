# UI consistency rollout

Use Home and Settings as the approved references. Apply the same visual system while keeping
layouts appropriate to each task. Work through the stages in order, with a focused commit for
each completed stage. Inspect each screen before editing; update only the inconsistencies found.

## Shared rules

- Use the semantic theme, neutral surfaces, and prepared Inter families in `appearance.ts`.
- Use Inter Display for balances and prominent amounts; keep existing amount units and formatting.
- Default to the Bitcoin symbol for satoshi presentation while respecting saved preferences.
- Keep lists compact: 14-point labels, 12-point descriptions, and at least 48-point touch targets.
- Use `$6` grouped corners, clipped rows, and full-width 2-point separators.
- Match Home's neutral action-card palette and existing hover/pressed states.
- Use meaningful, consistently sized icons, chevrons for internal navigation, external-link icons
  for websites, and checkmarks for selected options.
- Use left back arrows for previous steps and left close controls for dismissible root flows.
- Preserve accessible feedback, reduced motion, existing spinners, and semantic status colors.
- Preserve wallet behavior, authentication, validation, recovery, and in-flight navigation guards.
- Reuse existing components before adding abstractions. Do not change dependencies for styling.

## Stages

### 1. Home — implemented

- [x] Keep balance, Scan/Receive/Send actions, and mints together in that order.
- [x] Remove backup, username, and supporter prompt cards from Home.
- [x] Show recommendations only when no mint is connected.
- [x] Use compact grouped mint rows, right-aligned amounts, and navigation cues.
- [x] Improve balance and mint-header touch targets and action-icon consistency.
- [x] Default to the Bitcoin symbol without overriding explicitly saved preferences.
- [x] Remove the unused Home prompt implementation and supporter dismissal controls.
- [x] Pass type checking, the structure check, and 36 focused tests.
- [ ] Review light/dark appearance, large text, long amounts, and small screens on a device.

### 2. Mints

- [ ] Review mint management, Add mint, discovery, profile, details, and mint selection.
- [ ] Align grouped surfaces, row density, artwork slots, amount alignment, and metadata text.
- [ ] Keep mint warnings, trust/consent information, and supported-method information clear.
- [ ] Preserve whole-row navigation and mint selection behavior; selection remains a simple list.
- [ ] Validate mint navigation and selection tests; review empty and unreachable states on device.

### 3. Payment entry

- [ ] Review Send, Receive, Transfer, Lightning, on-chain, and Nostr amount/input stages.
- [ ] Align amount typography, currency presentation, input spacing, mint selectors, and actions.
- [ ] Keep shared bottom sheets and step-navigation conventions consistent.
- [ ] Preserve parsing, unit conversion, recipient validation, fees, and payment execution.
- [ ] Run focused amount/input tests and document manual payment checks.

### 4. Confirmation, pending states, and results

- [ ] Review payment confirmations, pending payments, results, token details, and receipt sheets.
- [ ] Align status, amount, detail-group, fee, and action hierarchy using existing shared components.
- [ ] Keep pending/unclaimed/unresolved states distinct and preserve receipt navigation.
- [ ] Run receipt and payment-presentation tests; review successful, failed, and pending flows.

### 5. History and wallet activity

- [ ] Review History, transaction details, wallet activity, and activity details.
- [ ] Align row density, amount formatting, dates, status colors, and grouped details.
- [ ] Preserve transaction grouping, filtering, reclaim actions, notes, and activity records.
- [ ] Run focused history/activity tests and review empty and mixed-transaction lists.

### 6. People and conversations

- [ ] Review People, search, profiles/person details, conversations, and contact/message sheets.
- [ ] Align avatars, names, descriptions, navigation cues, and action controls.
- [ ] Preserve conversation layouts, unread indicators, verification, and payment/contact states.
- [ ] Run focused People/conversation tests and review long names and large text.

### 7. Settings, security, and recovery

- [ ] Audit remaining Settings destinations against the existing Settings layout.
- [ ] Keep main/category rows navigation-only and preference controls on dedicated screens.
- [ ] Align switches, descriptions, grouped operation details, and progress/error presentation.
- [ ] Keep sensitive values protected on direct entry, blur, and background.
- [ ] Preserve recovery/backup semantics and operation guards; document device authentication checks.

### 8. Onboarding

- [ ] Review welcome, consent, seed import, creation progress, and permissions.
- [ ] Align typography, spacing, buttons, and feedback, with one clear primary action per step.
- [ ] Preserve consent, recovery validation, wallet creation, and permission handling.
- [ ] Run relevant onboarding tests and review keyboard and small-screen layouts.

### 9. Scanner, NFC, and final cross-screen review

- [ ] Align scanner and NFC headings, controls, instructions, and dismissal behavior.
- [ ] Keep camera and NFC task layouts focused and preserve native lifecycle behavior.
- [ ] Check shared loading, empty, offline, disabled, error, and success states across the rollout.
- [ ] Review light/dark themes, reduced motion, screen-reader labels, large text, and long amounts.
- [ ] Complete device checks for scanning, NFC, biometrics, notifications, and payment flows.

## Validation per stage

Run the narrowest relevant existing tests first and add regression coverage for behavior changes.
Run `yarn typecheck` for code changes and `yarn check:structure` when adding, moving, or deleting
routes or feature files. Format only touched files. Record the actual checks and remaining device
verification with each commit or handoff. Do not mark device review complete from unit tests alone.
