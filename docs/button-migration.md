# Button migration report

## BUI rollout (2026-11-06)

AppButton, AppIconButton, HeaderIconButton and AppTextButton now share the BUI renderer in
`src/shared/ui/BUI/BUIButtonControl.tsx`. The BUI catalog uses that renderer too. AppButton remains
the compatibility API, preserving event handlers, loading labels, refs, accessibility states,
semantic intent and navigation integrations.

Buttons use monochrome primary fills (black in light mode, white in dark mode), neutral secondary
fills, transparent tertiary actions, 500-weight
Inter labels, and size-specific corners (large: 56 high / radius 16; medium: 48 / radius 24).
Compact icon controls retain proportional glyphs and hit slop reaching 48 points. Large labeled
actions default to full width; explicit width, flex layouts and `fullWidth={false}` support paired
and inline controls. Main mint connection, scanner recovery and Transfer recovery actions now
use large buttons. Home shortcuts use BUI action controls, retaining Scan's 20-point glyph and
3-point stroke. The Home mint selector keeps a compact 36-point height, 12-point corners and
theme-inverse accent fill/foreground, with hit slop reaching 48 points and its offline error color.

The optional Accent style uses Obsidian purple (`#8A5CF5`, from hsl(258, 88%, 66%)) with white
text in both themes. Use `AppButton variant="accent"` or `BUIButton variant="Accent"` explicitly;
existing callers remain default primary. Hover/press accent fills retain their purple colors.
Disabled filled primary/accent/semantic buttons use neutral `gray3`; disabled secondary buttons
use `gray2`. All disabled labels and icons use the muted foreground, including ghost/text actions
and catalog buttons. Loading retains the enabled palette and spinner color.
Custom fills can use `$accentBackground` and `$accentForeground`. `$primaryColor` / `$onPrimary`
expose the monochrome pair; legacy `$accentColor` / `$onAccent` remain monochrome compatibility
aliases so existing controls (including Home's mint trigger) retain their intended palette.
The accent reference is [Obsidian's color documentation](https://docs.obsidian.md/Reference/CSS%20variables/Foundations/Colors).
The POS theme retains its existing palette. Semantic supporting-action contrast checks remain.
Wallet, payment, authentication and recovery logic are unchanged. Device checks remain necessary
for small screens, text scaling, screen readers, NFC, biometrics and end-to-end payments.

Light-theme secondary/card surfaces resolve Tamagui's standard `gray2`, and secondary button
fills resolve `gray3` (`gray4` when pressed, `gray2` when disabled). The BUI gray
tokens retain those same Tamagui values instead of the former violet-tinted overrides.

The wallet and BUI themes share these neutral roles across Home, mint details/preview, Settings,
People, history, NFC and shared fields/loading surfaces. Cards and grouped navigation rows use
`$gray2`, with `$gray3` hover and `$gray4` press feedback. Secondary buttons
and header/navigation controls use `$gray3`, with `$gray4` feedback and `$gray2` disabled fills.
The Home secondary-currency control and the Scan/Transfer/Receive/Send action circles also use
`$gray2`; the currency control retains gray3/4 interaction feedback.
Dark mode uses its existing gray2/3/4 values with the same hierarchy. Semantic status colors,
the POS palette, the compact inverse Home mint trigger, and tab/header layouts stay intact.

### Mint details and preview

Mint details and the unconnected mint preview use BUI cards, list/property rows, action buttons,
status labels and text roles. Cards keep 16-point corners and grow with their content. Page/card
padding and section gaps use 16 points, with 8-point gaps for related items. The balance uses the
BUI numeric role; descriptions, metadata, facts and headings use the corresponding BUI text roles.
Long fact values and warnings remain readable without a fixed card height. Both screens use
BUI list groups and section headers, semantic typography roles, and full-width 2-point BUI
separators. Share and Show QR have visible button labels; recovery is labeled Restore funds.
Advertised features and connection warnings use BUI rows, and consent uses BUISelectionRow.

`MintAppearance` scopes the active light/dark BUI theme through `BUIAppearanceProvider`; it does
not change the catalog preference or other screens. `BUIListRow.expanded` carries the existing
payment-detail and reliability disclosure state into accessibility. Connection, nickname edits,
recovery, removal, sharing, QR and payment callbacks retain their existing behavior.

### Headers and navigation

Settings and non-tab route headers use BUIHeader through AppScreenHeader and the existing
useScreenHeaderOptions hook. Payment receipts, the scanner, NFC, Send/Receive and mint sheets,
conversation screens, and receipt previews use the same BUI header geometry. Custom title content
(such as mint-name editing and contact details), navigation callbacks and operation locks stay
owned by their screens. NFC title changes retain polite announcements. BUI chrome follows the
active light/dark theme rather than the catalog preference, and retains the POS palette.

Main Home/History/People tab headers and the original custom bottom navigation stay in place.
Settings remains the explicit exception, with its centered BUI header, back behavior and hidden
tab bar. HeaderIconButton uses a 32-point neutral circle with a 22-point glyph and hit slop to
48 points; selected/expanded header controls use primary emphasis. This includes Home's NFC
shortcut without changing its reader action.

All 286 former Tamagui Button usages in 95 caller files have been migrated: **248 AppButton actions, 35 AppPressable controls, and 3 noninteractive badges**. The Button inside AppButton is the only permitted raw Tamagui Button.

## Operation feedback and compact icon actions

Icon-only actions use AppIconButton, a ref-forwarding AppButton wrapper requiring an icon and accessible label. It forbids visible children and trailing icons. Compact density uses 4-point padding, minimum dimensions 32/36/40/48/56 and proportional icons/spinners 14/16/18/20/24, including tertiary actions. Shared header controls use 22-point icons. Rounded radii, circular shapes, theme palettes, reduced motion, and hit slop reaching 48 points remain shared with AppButton. Home action cards retain their own styling.

ProcessingSheet and PaymentStatusOverlay have been deleted. Visible initiating buttons own progress with labels such as “Creating ecash…”, “Receiving ecash…”, and “Checking payment…”. Automatic decoding, automatic payment delivery, on-chain preparation/payment, and wallet creation use usePendingOperationToast under OperationFeedbackProvider. Each hook has a stable identity; phase updates replace only its own record, and completion/unmount removes only that record. Infinite-duration, controlled, polite pending toasts coexist with ordinary completion toasts and other operations. Pending toasts have no pointer interaction and prevent Escape/swipe dismissal.

AppToast accepts a typed explicit kind (loading, success, error, warning, info) before legacy title inference, renders only a bold title with a matching 16-point icon and heavier strokes, and uses the shared reduced-motion spinner. Ordinary, action, and pending toasts all use one title, with useful error details folded into that message. Pending hooks no longer accept descriptions. Payment-request delivery reports “Payment sent; awaiting receipt” as info. Receipt polling stays quiet and existing payment confirmation determines success. Request-generation failures remain inline with an error toast and the Generate Request retry action. WalletCreationTask retains the existing mnemonic callback sequence without simulated progress phases. No dependencies or wallet/recovery semantics changed.

The shared components retain compact icon actions and button-owned loading. The temporary development playground has been removed. Manual Android/browser layout, large text, NFC, biometrics, and real payment checks still require devices.

## Operation feedback verification (2026-10-15)

- Migrated 73 icon actions across 44 caller files, including Home shortcuts, keypad deletion, proof counters, and the offline-mode switch. The button audit now rejects icon-only AppButton callers outside AppIconButton.
- Native Jest: 42 suites and 213 tests passed. New coverage includes compact geometry, forwarded refs, loading labels, reduced motion, concurrent pending records, phase updates, timeout configuration, independent cleanup, screen blur/unmount, repeated operations, button-to-toast handoff, scan/shared-link decoding, automatic payment delivery, pending receipt polling, safe delivery retries, request-generation errors, and the headless wallet-creation sequence.
- Title-only toast update: audited all 122 ordinary/pending toast calls. No secondary descriptions remain; titles use 16-point, weight-800 text with 16-point icons and stroke width 3. Useful error and recovery details are included in the title.
- Web Jest: 5 checks passed, covering keyboard/focus behavior, busy/disabled ARIA state, links, refs, a real popover trigger, and icon controls under real light/dark themes.
- TypeScript and the button audit passed. No executable references to the removed sheets remain. Structure and scoped formatting are checked with the repository commands.
- Manual Android and real-browser layout, large text, screen-reader behavior, touch targets, NFC, biometrics, and end-to-end payments remain unverified. Automated UI tests use mocked wallet/network boundaries; no live payment was made.

## Choosing a button

Variant expresses intent; emphasis expresses prominence. Set both explicitly at migrated call sites.

| Intent                        | Variant / emphasis   | Examples                                                              |
| ----------------------------- | -------------------- | --------------------------------------------------------------------- |
| Main forward action           | branded / primary    | Send, Pay, Continue, Confirm, Save, Unlock, Add Mint, Claim           |
| Supporting action             | default / secondary  | Back, Cancel, Copy, Share, Paste, View Details                        |
| Sole neutral completion       | default / primary    | Done, Close, Got It, Return Home                                      |
| Lightweight utility           | default / tertiary   | Refresh, scan input, edit nickname, dismiss icon                      |
| Text navigation               | default / text-only  | Skip, Maybe Later, Cancel Edit                                        |
| Destructive confirmation      | critical / primary   | Delete Wallet, Confirm Remove, Delete Transaction, Erase Spent Proofs |
| Destructive supporting action | critical / secondary | Remove Mint, Decline Request, Cancel invoice                          |
| Existing caution action       | warning / secondary  | Reclaim Token                                                         |

Home uses branded-primary for Send, and default-secondary for Scan, Swap, and Receive. Request beside Send and Import beside Create Wallet stay secondary. Copy controls remain neutral even after a successful operation. A successful claim changes its remaining Done action to default-primary.

An error does not make retry destructive: Try Again is branded-primary when it is the main recovery action. Keep success/error/warning meaning in status text, icons, and badges. Preserve all existing warnings and confirmation steps.

## Shared APIs and compatibility

- AppButton supports labeled actions and an iconOnly mode that requires an icon and accessibilityLabel. shape defaults to rounded; circular is supported for icon-only actions.
- Icons accept a component or typed element. The button owns icon size and foreground color; element-specific details such as strokeWidth and fill survive normalization.
- Loading shows only a centered spinner, hiding the label and icons while preserving the button's dimensions. `loadingText` optionally supplies an accessible status without adding visible text. The caller owns loading state. Loading/disabled states block presses and expose busy/disabled accessibility state.
- Explicit width, flex, margins, and alignment remain available; fullWidth takes precedence over width. Palette, typography, radius, padding, and interaction feedback remain component-owned. Forwarded refs and link roles are retained for slotted navigation/popover triggers.
- The five sizes use minimum heights 32/36/40/48/56, fonts 12/13/14/16/18, icons 14/16/18/20/24, and rounded radii 8/10/12/16/20. Smaller targets add hit slop to reach 48 points. Labels can wrap and grow with system text scaling.
- AppPressable uses React Native Pressable for interaction and Tamagui usePropsAndStyle for theme-aware layout. It supports arbitrary content, keyboard activation through React Native Web, disabled press blocking, nested event propagation, forwarded refs, focus outlines, and reduced-motion feedback. Caller styles preserve specialized shapes/layouts.
- Filter chips, theme options, selectors, amount presets, keypad keys, counter controls, and rich rows remain composed in their owning components. Selected controls expose selection; sheet triggers expose actual expanded state through an optional onOpenChange callback on AppBottomSheet/MintSelectorSheet.
- Trusted/Untrusted/Active indicators are text badges, not disabled buttons. The diagnostics indicator and favorite toggle keep their existing state cues.

## Palette and contrast

Branded primary backgrounds resolve the active theme's blue10, including nested themes, and retain darker hover/press colors. White labels on the requested blue10 palette do not reach 4.5:1 in both themes; the existing branded idle contrast test explicitly uses a 3:1 floor. Other enabled solid palettes and tertiary states are checked against 4.5:1. This migration preserves the requested blue10/white combination and the user's disabled colors.

## Original button migration verification

- Source-expression audit: all 351 original onPress and disabled expressions preserved across the 95 migrated files; only the three informational badges intentionally stop being disabled controls.
- Native Jest: 36 suites, 194 tests passed, including shared controls, spinner cleanup, focus/reduced motion, and NFC lock/retry/refresh checks.
- Web Jest: 3 DOM checks passed for native button semantics, focus/disabled/selection state, forwarded link refs, and a real popover trigger. JSDOM does not synthesize a keyboard click on native HTML buttons, so that browser default action is simulated explicitly in the test.
- TypeScript, structure, raw-button boundary, and scoped Prettier checks passed.
- Run yarn check:buttons to enforce the raw-Button boundary; yarn validate includes this check. Run yarn test:web:buttons for DOM keyboard/ref/link checks.
- Manual Android and real-browser screenshots, small-screen layout, large text, touch alignment, popover placement, and end-to-end NFC/biometric/payment device checks remain outstanding. No live payment or network action was used for this migration.

## Per-file inventory

This inventory records the original Tamagui migration. Icon-only entries now use AppIconButton, including keypad deletion, proof counters, and the offline-mode switch; their handlers and accessibility states remain feature-owned.

The numbers below identify former Button occurrences within each file in source order. Every row is migrated. Layout compositions remain feature-owned; specialized controls are not forced into AppButton's label API.

- [app/(modals)/+not-found.tsx](<../src/app/(modals)/+not-found.tsx>) — **1 usages**. #1 Go to Home: AppButton default/primary.
- [app/(modals)/_layout.tsx](<../src/app/(modals)/_layout.tsx>) — **1 usages**. #1 "Close": AppButton default/secondary.
- [app/(tabs)/history.tsx](<../src/app/(tabs)/history.tsx>) — **1 usages**. #1 "Filter history": AppButton default/tertiary.
- [app/(tabs)/_layout.tsx](<../src/app/(tabs)/_layout.tsx>) — **1 usages**. #1 "Open NFC": AppButton default/tertiary.
- [features/history/components/PendingMintInvoiceLayout.tsx](../src/features/history/components/PendingMintInvoiceLayout.tsx) — **2 usages**. #1 Cancel: AppButton critical/secondary; #2 {isCheckingPaid ? '...' : 'I Paid'}: AppButton branded/primary.
- [features/history/index.tsx](../src/features/history/index.tsx) — **5 usages**. #1 {chip.label}: AppPressable; #2 {getMintFilterLabel(mintFilter)}: AppPressable; #3 {getTimeFilterLabel(timeFilter)}: AppPressable; #4 Clear: AppButton default/secondary; #5 Clear Filters: AppButton default/secondary.
- [features/history/TransactionDetailsScreen.tsx](../src/features/history/TransactionDetailsScreen.tsx) — **8 usages**. #1 "Delete transaction": AppButton default/tertiary; #2 Cancel: AppButton default/secondary; #3 Delete: AppButton critical/primary; #4 CLAIM NOW: AppButton branded/primary; #5 Copy: AppButton default/secondary; #6 Share: AppButton default/secondary; #7 Go Back: AppButton default/secondary; #8 "Copy": AppButton default/tertiary.
- [features/home/components/ActionButtons.tsx](../src/features/home/components/ActionButtons.tsx) — **4 usages**. #1 "Scan QR code": AppButton default/secondary; #2 "Swap": AppButton default/secondary; #3 "Receive": AppButton default/secondary; #4 "Send": AppButton branded/primary.
- [features/home/components/PromptCardStack.tsx](../src/features/home/components/PromptCardStack.tsx) — per-card dismissal uses HeaderIconButton (AppButton default/tertiary).
- [features/home/components/ConnectedMintsCard.tsx](../src/features/home/components/ConnectedMintsCard.tsx) — **3 usages**. #1 Add: AppButton branded/primary; #2 "Add mint": AppButton default/tertiary; #3 Add Mint: AppButton branded/primary.
- [features/home/components/NostrActivity.tsx](../src/features/home/components/NostrActivity.tsx) — **2 usages**. #1 Pay Request: AppButton branded/primary; #2 Decline: AppButton critical/secondary.
- [features/mints/AddMintScreen.tsx](../src/features/mints/AddMintScreen.tsx) — **6 usages**. #1 Add: AppButton branded/primary; #2 "Go back": AppButton default/tertiary; #3 "Scan QR code": AppButton default/tertiary; #4 Add: AppButton branded/primary; #5 Retry: AppButton branded/primary; #6 {'Load More Mints (${filteredDiscoveredMints.length - visibleCount} remaining)'}: AppButton default/secondary.
- [features/mints/index.tsx](../src/features/mints/index.tsx) — **3 usages**. #1 Go Back: AppButton default/secondary; #2 "Copy": AppButton default/tertiary; #3 {isTrusted ? 'Mint Trusted' : isAlreadyAdded ? 'Trust this Mint' : 'Connect to this Mint'}: AppButton branded/primary.
- [features/mints/MintDetailsScreen.tsx](../src/features/mints/MintDetailsScreen.tsx) — **11 usages**. #1 Go Back: AppButton default/primary; #2 "Go back": AppButton default/secondary; #3 "Share": AppButton default/secondary; #4 Trusted: text badge; #5 Untrusted: text badge; #6 Active: text badge; #7 About Mint: AppPressable; #8 {isRestoring && restoringMintUrl === mintUrl ? 'Restoring...' : 'Restore'}: AppButton branded/primary; #9 Remove: AppButton critical/secondary; #10 Confirm Remove: AppButton critical/primary; #11 Cancel: AppButton default/secondary.
- [features/nfc/NfcSheetHost.tsx](../src/features/nfc/NfcSheetHost.tsx) — **4 usages**. #1 {primaryAction.label}: AppButton branded/primary; #2 Refresh status: AppButton default/secondary; #3 Check NFC: AppButton default/secondary; #4 View History: AppButton default/secondary.
- [features/nostr/components/NostrClaimSheet.tsx](../src/features/nostr/components/NostrClaimSheet.tsx) — **2 usages**. #1 {claimStatus === 'success' ? 'Done' : 'Delete'}: AppButton {claimStatus === 'success' ? 'default' : 'critical'}/{claimStatus === 'success' ? 'primary' : 'secondary'}; #2 {mintTrusted === false ? 'Trust & Claim' : 'Try Again'}: AppButton branded/primary.
- [features/nostr/index.tsx](../src/features/nostr/index.tsx) — **5 usages**. #1 Copy: AppButton default/secondary; #2 Edit: AppButton default/text-only; #3 Delete: AppButton critical/secondary; #4 Updating Username... / Claiming Username... / Update Username / Claim Username: AppButton branded/primary; #5 Cancel Edit: AppButton default/text-only.
- [features/nostr/NostrActivityScreen.tsx](../src/features/nostr/NostrActivityScreen.tsx) — **2 usages**. #1 {copied ? 'Copied!' : 'Copy Token'}: AppButton default/secondary; #2 Done: AppButton default/primary.
- [features/nostr/NostrDiagnosticsScreen.tsx](../src/features/nostr/NostrDiagnosticsScreen.tsx) — **4 usages**. #1 "Refresh": AppButton default/secondary; #2 Repair profile: AppButton default/secondary; #3 Republish inbox relay list: AppButton default/secondary; #4 Reconnect relays: AppButton default/secondary.
- [features/nostr/NostrProfileScreen.tsx](../src/features/nostr/NostrProfileScreen.tsx) — **4 usages**. #1 "Refresh": AppButton default/tertiary; #2 "Scan QR code": AppButton default/tertiary; #3 Add: AppButton branded/primary; #4 "Retry NIP-05 lookup": AppButton default/tertiary.
- [features/nostr/NostrSettingsScreen.tsx](../src/features/nostr/NostrSettingsScreen.tsx) — **4 usages**. #1 "Copy": AppButton default/tertiary; #2 "Copy": AppButton default/tertiary; #3 {isNsecVisible ? 'Hide private key' : 'Reveal private key'}: AppButton default/tertiary; #4 Nostr health {diagnostics ? diagnostics.overall : 'Checking…'}: AppPressable.
- [features/onboarding/ConsentStep.tsx](../src/features/onboarding/ConsentStep.tsx) — **2 usages**. #1 "Go back": AppButton default/tertiary; #2 Agree & Continue: AppButton branded/primary.
- [features/onboarding/ImportSeedStep.tsx](../src/features/onboarding/ImportSeedStep.tsx) — **4 usages**. #1 Clear: AppButton default/secondary; #2 Paste: AppButton default/secondary; #3 Confirm: AppButton branded/primary; #4 Back: AppButton default/secondary.
- [features/onboarding/PermissionsStep.tsx](../src/features/onboarding/PermissionsStep.tsx) — **3 usages**. #1 Finish & Open Wallet: AppButton branded/primary; #2 Enable Biometrics: AppButton branded/primary; #3 Skip & Finish: AppButton default/text-only.
- [features/onboarding/WelcomeStep.tsx](../src/features/onboarding/WelcomeStep.tsx) — **4 usages**. #1 Delete & Start Over: AppButton critical/secondary; #2 Open saved wallet: AppButton branded/primary; #3 Import existing wallet: AppButton default/secondary; #4 Create a new wallet: AppButton branded/primary.
- [features/payments/melt/index.tsx](../src/features/payments/melt/index.tsx) — **2 usages**. #1 Back: AppButton default/secondary; #2 {isPaying ? 'Paying...' : 'Pay'}: AppButton branded/primary.
- [features/payments/melt/InvoiceStage.tsx](../src/features/payments/melt/InvoiceStage.tsx) — **1 usages**. #1 {conversionValue}: AppPressable.
- [features/payments/melt/OnchainMeltFlow.tsx](../src/features/payments/melt/OnchainMeltFlow.tsx) — **5 usages**. #1 Try Again: AppButton branded/primary; #2 Done: AppButton default/primary; #3 Go Back: AppButton default/primary; #4 Confirm & Send: AppButton branded/primary; #5 {conversionValue}: AppPressable.
- [features/payments/melt/ResultStage.tsx](../src/features/payments/melt/ResultStage.tsx) — **3 usages**. #1 Refresh status: AppButton default/secondary; #2 Go Back: AppButton default/primary; #3 Done: AppButton default/primary.
- [features/payments/mint/AmountStage.tsx](../src/features/payments/mint/AmountStage.tsx) — **4 usages**. #1 {conversionValue}: AppPressable; #2 1k: AppPressable; #3 5k: AppPressable; #4 20k: AppPressable.
- [features/payments/mint/ConfirmStage.tsx](../src/features/payments/mint/ConfirmStage.tsx) — **2 usages**. #1 Go Back: AppButton default/secondary; #2 {isLoading ? 'Creating...' : 'Confirm'}: AppButton branded/primary.
- [features/payments/mint/OnchainMintFlow.tsx](../src/features/payments/mint/OnchainMintFlow.tsx) — **5 usages**. #1 Go Back: AppButton default/primary; #2 Done: AppButton default/primary; #3 "Copy": AppButton default/secondary; #4 Close: AppButton default/primary; #5 Check: AppButton branded/primary.
- [features/payments/mint/PaymentStage.tsx](../src/features/payments/mint/PaymentStage.tsx) — **3 usages**. #1 Cancel: AppButton critical/secondary; #2 {isChecking ? '...' : 'I Paid'}: AppButton branded/primary; #3 "Copy": AppButton default/tertiary.
- [features/payments/mint/ResultStage.tsx](../src/features/payments/mint/ResultStage.tsx) — **2 usages**. #1 Go Back: AppButton default/primary; #2 Done: AppButton default/primary.
- [features/payments/OptimizeWalletScreen.tsx](../src/features/payments/OptimizeWalletScreen.tsx) — **3 usages**. #1 {isLoadingMint ? 'Loading...' : mintName}: AppPressable; #2 Optimizing wallet...: AppButton branded/primary; #3 {canOptimize ? 'Optimize Wallet' : 'Already Optimal'}: AppButton branded/primary.
- [features/payments/ProofsScreen.tsx](../src/features/payments/ProofsScreen.tsx) — **12 usages**. #1 "Share": AppButton default/tertiary; #2 "Copy": AppButton default/tertiary; #3 {meta.label} {counts[tab] > 0 && ( {counts[tab] > 99 ? '99+' : counts[tab]} )}: AppPressable; #4 {isCreatingToken ? 'Creating Token…' : 'Create Ecash Token'}: AppButton branded/primary; #5 {isDeleting ? 'Deleting…' : 'Delete Proof from Device'}: AppButton critical/primary; #6 Close: AppButton default/primary; #7 Back to Details: AppButton default/secondary; #8 "Go back": AppButton default/tertiary; #9 "Refresh": AppButton default/tertiary; #10 Custom control or row: AppPressable; #11 Export All ({filteredProofs.length}): AppButton default/secondary; #12 {isDeleting ? 'Erasing…' : 'Erase All Spent (${filteredProofs.length})'}: AppButton critical/primary.
- [features/payments/receive/ConfirmStage.tsx](../src/features/payments/receive/ConfirmStage.tsx) — **3 usages**. #1 {isSavingLater ? 'Saving...' : 'Claim Later'}: AppButton default/text-only; #2 Receiving... / Token Already Spent / Receive / Trust & Receive: AppButton branded/primary; #3 "Copy": AppButton default/tertiary.
- [features/payments/receive/InputStage.tsx](../src/features/payments/receive/InputStage.tsx) — **5 usages**. #1 Paste: AppButton default/secondary; #2 QR Code: AppPressable; #3 NFC: AppPressable; #4 {isLoading ? 'Decoding...' : 'Preview Token'}: AppButton branded/primary; #5 Paste from Clipboard: AppButton default/secondary.
- [features/payments/receive/ReceiveResultStage.tsx](../src/features/payments/receive/ReceiveResultStage.tsx) — **5 usages**. #1 Got it: AppButton default/primary; #2 Go Back: AppButton default/primary; #3 Claim Now: AppButton branded/primary; #4 Done: AppButton default/primary; #5 "Copy": AppButton default/tertiary.
- [features/payments/receive/RequestEcashStage.tsx](../src/features/payments/receive/RequestEcashStage.tsx) — **9 usages**. #1 "Share": AppButton default/tertiary; #2 "Copy": AppButton default/tertiary; #3 {conversionValue}: AppPressable; #4 "Clear input": AppButton default/tertiary; #5 Share: AppButton default/secondary; #6 {copied ? 'Copied!' : 'Copy Request'}: AppButton default/secondary; #7 {isPublishing ? 'Publishing...' : 'Publish on bey.cash'}: AppButton branded/primary; #8 Check Status: AppButton default/secondary; #9 New Request: AppButton default/secondary.
- [features/payments/ScannerScreen.tsx](../src/features/payments/ScannerScreen.tsx) — **6 usages**. #1 Grant Permission: AppButton branded/primary; #2 Cancel: AppButton default/secondary; #3 "Close": AppButton default/tertiary; #4 "Paste": AppButton default/secondary; #5 {flash === 'on' ? 'Turn flashlight off' : 'Turn flashlight on'}: AppButton default/tertiary; #6 Scan Again: AppButton branded/primary.
- [features/payments/SearchScreen.tsx](../src/features/payments/SearchScreen.tsx) — **2 usages**. #1 "Clear input": AppButton default/tertiary; #2 "Scan QR code": AppButton default/tertiary.
- [features/payments/send/AmountStage.tsx](../src/features/payments/send/AmountStage.tsx) — **1 usages**. #1 {conversionValue}: AppPressable.
- [features/payments/send/ConfirmStage.tsx](../src/features/payments/send/ConfirmStage.tsx) — **2 usages**. #1 Back: AppButton default/secondary; #2 {isLoading ? 'Creating...' : 'Send'}: AppButton branded/primary.
- [features/payments/send/index.tsx](../src/features/payments/send/index.tsx) — **1 usages**. #1 {isOffline ? ( ) : ( )}: AppPressable.
- [features/payments/send/NostrSendStage.tsx](../src/features/payments/send/NostrSendStage.tsx) — **2 usages**. #1 {conversionValue}: AppPressable; #2 "Paste": AppButton default/tertiary.
- [features/payments/send/P2PKAmountStage.tsx](../src/features/payments/send/P2PKAmountStage.tsx) — **1 usages**. #1 {conversionValue}: AppPressable.
- [features/payments/send/PaymentRequestStage.tsx](../src/features/payments/send/PaymentRequestStage.tsx) — **3 usages**. #1 Refresh status: AppButton default/secondary; #2 Cancel: AppButton default/secondary; #3 {isSending ? 'Sending…' : hasOperation ? 'Retry delivery' : 'Pay'}: AppButton branded/primary.
- [features/payments/send/ResultStage.tsx](../src/features/payments/send/ResultStage.tsx) — **3 usages**. #1 Go Back: AppButton default/primary; #2 Done: AppButton default/primary; #3 "Copy": AppButton default/tertiary.
- [features/payments/send/ScanAndPayStage.tsx](../src/features/payments/send/ScanAndPayStage.tsx) — **4 usages**. #1 Paste: AppButton default/secondary; #2 QR Code: AppPressable; #3 NFC: AppPressable; #4 {isLoading ? 'Processing...' : 'Preview Payment'}: AppButton branded/primary.
- [features/payments/send/SuccessStage.tsx](../src/features/payments/send/SuccessStage.tsx) — **2 usages**. #1 Done: AppButton default/primary; #2 "Copy": AppButton default/tertiary.
- [features/payments/swap/AmountStage.tsx](../src/features/payments/swap/AmountStage.tsx) — **1 usages**. #1 {conversionValue}: AppPressable.
- [features/payments/swap/index.tsx](../src/features/payments/swap/index.tsx) — **2 usages**. #1 Back: AppButton default/secondary; #2 {isProcessing ? 'Swapping...' : 'Swap'}: AppButton branded/primary.
- [features/payments/swap/ResultStage.tsx](../src/features/payments/swap/ResultStage.tsx) — **2 usages**. #1 Go Back: AppButton default/primary; #2 Done: AppButton default/primary.
- [features/payments/TokenDetailsScreen.tsx](../src/features/payments/TokenDetailsScreen.tsx) — **7 usages**. #1 Go Back: AppButton default/primary; #2 "More options": AppButton default/tertiary; #3 {speedLabel}: AppButton default/secondary; #4 {sizeLabel}: AppButton default/secondary; #5 {tokenVersion}: AppButton default/secondary; #6 "Share": AppButton default/secondary; #7 {copied ? 'Copied!' : 'Copy'}: AppButton default/secondary.
- [features/people/components/NostrProfileItem.tsx](../src/features/people/components/NostrProfileItem.tsx) — **1 usages**. #1 {'Send eCash to ${label}'}: AppButton branded/primary.
- [features/people/components/PeopleHeaderActions.tsx](../src/features/people/components/PeopleHeaderActions.tsx) — **3 usages**. #1 {connectionPercent === null ? '···' : '${connectionPercent}%'}: AppButton default/tertiary; #2 "Open Nostr activity": AppButton default/tertiary; #3 "Open Nostr settings": AppButton default/tertiary.
- The former PersonDetailsHeaderActions controls are now in [ConversationContactSheet](../src/features/people/components/ConversationContactSheet.tsx): copy/share/sync use default secondary; delete/block use critical secondary.
- [features/people/index.tsx](../src/features/people/index.tsx) — **3 usages**. #1 {isSearchActive ? 'Clear search' : 'Paste Nostr identifier'}: AppButton default/tertiary; #2 {label}: AppPressable; #3 Custom control or row: AppPressable.
- [features/people/PeopleSearchScreen.tsx](../src/features/people/PeopleSearchScreen.tsx) — **2 usages**. #1 "Paste": AppButton default/tertiary; #2 "Scan QR code": AppButton default/tertiary.
- The former PersonDetailsScreen is replaced by [ConversationScreen](../src/features/people/ConversationScreen.tsx). Back and the icon-only send action use default secondary; Request uses default secondary; Pay uses branded secondary. Identity and message details open AppBottomSheet. Legacy person-details links use this same screen; the profile QR controls were removed.
- [features/settings/BackupSeedScreen.tsx](../src/features/settings/BackupSeedScreen.tsx) — **1 usages**. #1 {copied ? 'Copied!' : 'Copy '}: AppButton default/secondary.
- [features/settings/components/DeleteWalletSheet.tsx](../src/features/settings/components/DeleteWalletSheet.tsx) — **3 usages**. #1 {copied ? 'Copied' : 'Copy'}: AppButton default/secondary; #2 I've Backed Up, Delete Everything: AppButton critical/primary; #3 Cancel: AppButton default/secondary.
- [features/settings/OtaUpdateScreen.tsx](../src/features/settings/OtaUpdateScreen.tsx) — **6 usages**. #1 Check Now: AppButton default/secondary; #2 Restart App: AppButton default/secondary; #3 Try Again: AppButton default/secondary; #4 Check for Updates: AppButton branded/primary; #5 Download & Install: AppButton branded/primary; #6 Restart App to Apply: AppButton branded/primary.
- [shared/ui/ActionSelectorSheet.tsx](../src/shared/ui/ActionSelectorSheet.tsx) — **2 usages**. #1 "Go back": AppButton default/tertiary; #2 "Close": AppButton default/tertiary.
- [shared/ui/AppToast.tsx](../src/shared/ui/AppToast.tsx) — **1 usages**. #1 {actionData.actionLabel}: AppButton default/secondary.
- [shared/ui/DestinationInputRow.tsx](../src/shared/ui/DestinationInputRow.tsx) — **3 usages**. #1 "Clear input": AppButton default/tertiary; #2 "Paste": AppButton default/tertiary; #3 "Scan QR code": AppButton default/tertiary.
- [shared/ui/HomeMintSelector.tsx](../src/shared/ui/HomeMintSelector.tsx) — **4 usages**. #1 "Close": AppButton default/tertiary; #2 Add: AppButton branded/primary; #3 "Edit nickname": AppButton default/tertiary; #4 {isLoading ? 'Loading...' : displayName}: AppPressable.
- [shared/ui/InfoSheet.tsx](../src/shared/ui/InfoSheet.tsx) — **1 usages**. #1 {config.buttonText}: AppButton default/primary.
- [shared/ui/ListTable.tsx](../src/shared/ui/ListTable.tsx) — **1 usages**. #1 "Copy": AppButton default/tertiary.
- [shared/ui/LockOverlay.tsx](../src/shared/ui/LockOverlay.tsx) — **1 usages**. #1 Unlock: AppButton branded/primary.
- [shared/ui/MintBalanceRow.tsx](../src/shared/ui/MintBalanceRow.tsx) — **1 usages**. #1 Max: AppButton default/secondary.
- [shared/ui/NumericKeypad.tsx](../src/shared/ui/NumericKeypad.tsx) — **3 usages**. #1 {digit}: AppPressable; #2 "Delete last digit": AppPressable; #3 {isLoading ? 'Processing...' : confirmLabel}: AppButton branded/primary.
- [shared/ui/OfflineDenominationSelector.tsx](../src/shared/ui/OfflineDenominationSelector.tsx) — **5 usages**. #1 Select All: AppButton default/secondary; #2 Clear: AppButton default/secondary; #3 "Select fewer proofs": AppPressable; #4 "Select more proofs": AppPressable; #5 Continue (Offline): AppButton branded/primary.
- [shared/ui/OfflineOptimizationSheet.tsx](../src/shared/ui/OfflineOptimizationSheet.tsx) — **3 usages**. #1 Back: AppButton default/secondary; #2 Select Coins Manually...: AppButton default/text-only; #3 Confirm & Continue: AppButton branded/primary.
- [shared/ui/OtaUpdateChecker.tsx](../src/shared/ui/OtaUpdateChecker.tsx) — **2 usages**. #1 Later: AppButton default/text-only; #2 Update Now: AppButton branded/primary.
- [shared/ui/PendingTokenLayout.tsx](../src/shared/ui/PendingTokenLayout.tsx) — **6 usages**. #1 {copied ? 'Copied!' : 'Copy'}: AppButton default/secondary; #2 Send: AppButton branded/primary; #3 Reclaim Token: AppButton warning/secondary; #4 Claim Now: AppButton branded/primary; #5 "Close": AppButton default/tertiary; #6 "Copy": AppButton default/tertiary.
- [shared/ui/ReceiveModeSelector.tsx](../src/shared/ui/ReceiveModeSelector.tsx) — **1 usages**. #1 {isLoading ? 'Loading...' : MODE_LABELS[mode]}: AppPressable.
- [shared/ui/SendMethodSelector.tsx](../src/shared/ui/SendMethodSelector.tsx) — **1 usages**. #1 {isLoading ? 'Loading...' : MODE_LABELS[mode]}: AppPressable.
- [shared/ui/StatusScreen.tsx](../src/shared/ui/StatusScreen.tsx) — **2 usages**. #1 {actionLabel}: AppButton branded/primary; #2 Close: AppButton default/primary.
- [shared/ui/ThemeSelector.tsx](../src/shared/ui/ThemeSelector.tsx) — **1 usages**. #1 {mode.label}: AppPressable.
- [shared/ui/UniversalInputCard.tsx](../src/shared/ui/UniversalInputCard.tsx) — **3 usages**. #1 "Clear input": AppButton default/tertiary; #2 {isValidating ? '...' : 'Go'}: AppButton branded/primary; #3 Paste: AppButton default/secondary.
- [shared/ui/UsernamePromptChecker.tsx](../src/shared/ui/UsernamePromptChecker.tsx) — **2 usages**. #1 Maybe Later: AppButton default/text-only; #2 Claim Now: AppButton branded/primary.
