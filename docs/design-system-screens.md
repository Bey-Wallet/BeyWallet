# Screen adoption inventory

Follow [the recorded rules](design-system-proposal.md). This is a review-and-adoption checklist: some screens already comply. Pending does not mean a confirmed visual defect. No production restyling is performed by recording this inventory.

Scope: production routes and development-client-only BUI previews, including aliases, one redirect and a legacy placeholder. Non-route onboarding, payment stages and shared presentations are listed below. Layouts, HTML setup and native-intent handlers are infrastructure.

## Main and detail routes

| Review  | Route file                    | Owner                                            | Scope / exception                                       |
| ------- | ----------------------------- | ------------------------------------------------ | ------------------------------------------------------- |
| Pending | `src/app/(tabs)/history.tsx`  | `~/features/history/HistoryTabScreen`            | Review neutral groups, typography and shared actions.   |
| Pending | `src/app/(tabs)/index.tsx`    | `~/features/home`                                | Home; full-width circular actions and inset mint panel. |
| Pending | `src/app/(tabs)/people.tsx`   | `~/features/people`                              | Review neutral groups, typography and shared actions.   |
| Pending | `src/app/txn-details.tsx`     | `~/features/history/TransactionDetailsScreen`    | Review neutral groups, typography and shared actions.   |
| Pending | `src/app/wallet-activity.tsx` | `~/features/history/WalletActivityDetailsScreen` | Review neutral groups, typography and shared actions.   |

## Every Settings destination and category

| Review    | Route file                                               | Owner                                                | Scope / exception                                                             |
| --------- | -------------------------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------- |
| Pending   | `src/app/(tabs)/settings/about.tsx`                      | `~/features/settings/AboutSettingsScreen`            | Review neutral groups, typography and shared actions.                         |
| Pending   | `src/app/(tabs)/settings/advanced.tsx`                   | `~/features/settings/SettingsCategoryScreen`         | Review neutral groups, typography and shared actions.                         |
| Pending   | `src/app/(tabs)/settings/backup-status.tsx`              | `~/features/settings/BackupStatusScreen`             | Review neutral groups, typography and shared actions.                         |
| Pending   | `src/app/(tabs)/settings/backup.tsx`                     | `~/features/settings/SettingsCategoryScreen`         | Review neutral groups, typography and shared actions.                         |
| Preview   | `src/app/(tabs)/settings/new-ui.tsx`                     | `~/features/settings/NewUiScreen`                    | Bey theme/component build catalog; see new-ui.md.                             |
| Preview   | `src/app/(tabs)/settings/new-ui-buttons.tsx`             | `~/features/settings/BUIButtonsScreen`               | BUI buttons: blue primary, sizes, variants, states and width toggle.          |
| Preview   | `src/app/(tabs)/settings/bui-layout.tsx`                 | `~/features/settings/BUILayoutScreen`                | BUI layout tokens, corners, row alignment and inset frame.                    |
| Preview   | `src/app/(tabs)/settings/bui-typography.tsx`             | `~/features/settings/BUITypographyScreen`            | BUIText roles, reading, wrapping, numerals and scale samples.                 |
| Preview   | `src/app/(tabs)/settings/bui-icons-avatars.tsx`          | `~/features/settings/BUIIconsAvatarsScreen`          | Lucide icons, avatar states, badges and overlapping images.                   |
| Preview   | `src/app/(tabs)/settings/bui-badges.tsx`                 | `~/features/settings/BUIBadgesScreen`                | Labels, counters, verification, badge buttons and placement/cutouts.          |
| Preview   | `src/app/(tabs)/settings/bui-forms.tsx`                  | `~/features/settings/BUIFormsScreen`                 | Floating fields, multiline/search/password compositions and local validation. |
| Preview   | `src/app/(tabs)/settings/bui-selections.tsx`             | `~/features/settings/BUISelectionsScreen`            | Switches, checkboxes, radio groups and accessible whole-row selections.       |
| Preview   | `src/app/(tabs)/settings/bui-tabs-chips.tsx`             | `~/features/settings/BUITabsChipsScreen`             | Content tabs, filter/outline chips, tags and anchored selectors.              |
| Preview   | `src/app/(tabs)/settings/bui-lists.tsx`                  | `~/features/settings/BUIListsScreen`                 | Grouped text/selection/property rows, wallet compositions and list states.    |
| Preview   | `src/app/(tabs)/settings/bui-cards.tsx`                  | `~/features/settings/BUICardsScreen`                 | Card surfaces, wallet/asset cards, setup, shelves and dismissible banners.    |
| Preview   | `src/app/(tabs)/settings/bui-navigation.tsx`             | `~/features/settings/BUINavigationScreen`            | Header variants, collapse, bottom tabs/action bars and local navigation.      |
| Preview   | `src/app/(tabs)/settings/bui-sheets.tsx`                 | `~/features/settings/BUISheetsScreen`                | Live sheets, draft forms/selection, local steps and alert/dialog variants.    |
| Preview   | `src/app/(tabs)/settings/bui-menus.tsx`                  | `~/features/settings/BUIMenusScreen`                 | Anchored action/selection/custom menus, overflow and measured tooltips.       |
| Preview   | `src/app/(tabs)/settings/new-ui-colors.tsx`              | `~/features/settings/NewUiColorsScreen`              | White/light and black/dark theme, relative surfaces and semantic swatches.    |
| Pending   | `src/app/(tabs)/settings/blocked-people.tsx`             | `~/features/settings/IdentityScreens`                | Review neutral groups, typography and shared actions.                         |
| Pending   | `src/app/(tabs)/settings/currency.tsx`                   | `~/features/settings/PreferenceScreens`              | Review neutral groups, typography and shared actions.                         |
| Pending   | `src/app/(tabs)/settings/delete-wallet.tsx`              | `~/features/settings/BackupScreens`                  | Review neutral groups, typography and shared actions.                         |
| Pending   | `src/app/(tabs)/settings/export-backup.tsx`              | `~/features/settings/BackupScreens`                  | Review neutral groups, typography and shared actions.                         |
| Pending   | `src/app/(tabs)/settings/fallback-mint.tsx`              | `~/features/settings/WalletSettingsScreens`          | Review neutral groups, typography and shared actions.                         |
| Pending   | `src/app/(tabs)/settings/get-change.tsx`                 | `~/features/settings/GetChangeSettingsScreen`        | Review neutral groups, typography and shared actions.                         |
| Pending   | `src/app/(tabs)/settings/help.tsx`                       | `~/features/settings/AboutSettingsScreen`            | Review neutral groups, typography and shared actions.                         |
| Pending   | `src/app/(tabs)/settings/identity.tsx`                   | `~/features/settings/SettingsCategoryScreen`         | Review neutral groups, typography and shared actions.                         |
| Pending   | `src/app/(tabs)/settings/index.tsx`                      | `~/features/settings`                                | Review neutral groups, typography and shared actions.                         |
| Pending   | `src/app/(tabs)/settings/lightning-address-mint.tsx`     | `~/features/settings/LightningAddressSettingsScreen` | Review neutral groups, typography and shared actions.                         |
| Pending   | `src/app/(tabs)/settings/lightning-address-payments.tsx` | `~/features/settings/LightningAddressSettingsScreen` | Review neutral groups, typography and shared actions.                         |
| Pending   | `src/app/(tabs)/settings/lightning-address.tsx`          | `~/features/settings/LightningAddressSettingsScreen` | Review neutral groups, typography and shared actions.                         |
| Pending   | `src/app/(tabs)/settings/mint-backup.tsx`                | `~/features/settings/MintBackupSettingsScreen`       | Review neutral groups, typography and shared actions.                         |
| Pending   | `src/app/(tabs)/settings/mints.tsx`                      | `~/features/settings/WalletSettingsScreens`          | Review neutral groups, typography and shared actions.                         |
| Pending   | `src/app/(tabs)/settings/nostr.tsx`                      | `~/features/settings/SettingsCategoryScreen`         | Review neutral groups, typography and shared actions.                         |
| Pending   | `src/app/(tabs)/settings/notifications.tsx`              | `~/features/settings/NotificationSettingsScreen`     | Review neutral groups, typography and shared actions.                         |
| Pending   | `src/app/(tabs)/settings/optimize-wallet.tsx`            | `~/features/settings/WalletSettingsScreens`          | Review neutral groups, typography and shared actions.                         |
| Pending   | `src/app/(tabs)/settings/preferences.tsx`                | `~/features/settings/SettingsCategoryScreen`         | Review neutral groups, typography and shared actions.                         |
| Pending   | `src/app/(tabs)/settings/profile.tsx`                    | `~/features/nostr/NostrProfileScreen`                | Review neutral groups, typography and shared actions.                         |
| Pending   | `src/app/(tabs)/settings/proofs.tsx`                     | `~/features/settings/WalletSettingsScreens`          | Review neutral groups, typography and shared actions.                         |
| Pending   | `src/app/(tabs)/settings/public-key.tsx`                 | `~/features/settings/IdentityScreens`                | Review neutral groups, typography and shared actions.                         |
| Pending   | `src/app/(tabs)/settings/receiving-policy.tsx`           | `~/features/settings/IdentityScreens`                | Review neutral groups, typography and shared actions.                         |
| Pending   | `src/app/(tabs)/settings/recover-funds.tsx`              | `~/features/settings/RecoverFundsScreen`             | Review neutral groups, typography and shared actions.                         |
| Pending   | `src/app/(tabs)/settings/recovery-phrase.tsx`            | `~/features/settings/BackupScreens`                  | Review neutral groups, typography and shared actions.                         |
| Pending   | `src/app/(tabs)/settings/relays.tsx`                     | `~/features/settings/RelaySettingsScreen`            | Review neutral groups, typography and shared actions.                         |
| Pending   | `src/app/(tabs)/settings/restore-backup.tsx`             | `~/features/settings/BackupScreens`                  | Review neutral groups, typography and shared actions.                         |
| Pending   | `src/app/(tabs)/settings/secret-key.tsx`                 | `~/features/settings/IdentityScreens`                | Review neutral groups, typography and shared actions.                         |
| Pending   | `src/app/(tabs)/settings/security.tsx`                   | `~/features/settings/SettingsCategoryScreen`         | Review neutral groups, typography and shared actions.                         |
| Pending   | `src/app/(tabs)/settings/supporter.tsx`                  | `~/features/supporter/SupporterSettingsScreen`       | Review neutral groups, typography and shared actions.                         |
| Pending   | `src/app/(tabs)/settings/theme.tsx`                      | `~/features/settings/PreferenceScreens`              | Review neutral groups, typography and shared actions.                         |
| Pending   | `src/app/(tabs)/settings/updates.tsx`                    | `~/features/settings/OtaUpdateScreen`                | Review neutral groups, typography and shared actions.                         |
| Pending   | `src/app/(tabs)/settings/username.tsx`                   | `~/features/nostr`                                   | Review neutral groups, typography and shared actions.                         |
| Pending   | `src/app/(tabs)/settings/verify-proofs.tsx`              | `~/features/settings/WalletSettingsScreens`          | Review neutral groups, typography and shared actions.                         |
| Pending   | `src/app/(tabs)/settings/wallet.tsx`                     | `~/features/settings/SettingsCategoryScreen`         | Review neutral groups, typography and shared actions.                         |

## Modals and compatibility entries

| Review  | Route file                               | Owner                                               | Scope / exception                                                  |
| ------- | ---------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------ |
| Pending | `src/app/(modals)/+not-found.tsx`        | `Inline route UI`                                   | Review neutral groups, typography and shared actions.              |
| Pending | `src/app/(modals)/add-mint.tsx`          | `~/features/mints/AddMintScreen`                    | Review neutral groups, typography and shared actions.              |
| Pending | `src/app/(modals)/backup-seed.tsx`       | `~/features/settings/BackupSeedScreen`              | Review neutral groups, typography and shared actions.              |
| Pending | `src/app/(modals)/conversation.tsx`      | `~/features/people/ConversationScreen`              | Review neutral groups, typography and shared actions.              |
| Pending | `src/app/(modals)/discover-mints.tsx`    | `~/features/mints/AddMintScreen`                    | Alias/shared destination; migrate the owning implementation once.  |
| Pending | `src/app/(modals)/melt.tsx`              | `~/features/payments/melt`                          | Review neutral groups, typography and shared actions.              |
| Pending | `src/app/(modals)/mint-details.tsx`      | `~/features/mints/MintDetailsScreen`                | Review neutral groups, typography and shared actions.              |
| Pending | `src/app/(modals)/mint-profile.tsx`      | `~/features/mints`                                  | Review neutral groups, typography and shared actions.              |
| Pending | `src/app/(modals)/mint.tsx`              | `~/features/payments/mint`                          | Review neutral groups, typography and shared actions.              |
| Pending | `src/app/(modals)/nostr-activity.tsx`    | `~/features/nostr/NostrActivityScreen`              | Review neutral groups, typography and shared actions.              |
| Pending | `src/app/(modals)/nostr-diagnostics.tsx` | `~/features/nostr/NostrSettingsScreen`              | Alias/shared destination; migrate the owning implementation once.  |
| Pending | `src/app/(modals)/nostr-profile.tsx`     | `~/features/nostr/NostrProfileScreen`               | Review neutral groups, typography and shared actions.              |
| Pending | `src/app/(modals)/nostr-settings.tsx`    | `~/features/nostr/NostrSettingsScreen`              | Review neutral groups, typography and shared actions.              |
| Pending | `src/app/(modals)/nostr-username.tsx`    | `~/features/nostr`                                  | Review neutral groups, typography and shared actions.              |
| Pending | `src/app/(modals)/not-found.tsx`         | `Inline route UI`                                   | Legacy placeholder; verify reachability before changing.           |
| Pending | `src/app/(modals)/optimize-wallet.tsx`   | `~/features/payments/OptimizeWalletScreen`          | Review neutral groups, typography and shared actions.              |
| Pending | `src/app/(modals)/ota-update.tsx`        | `~/features/settings/OtaUpdateScreen`               | Alias/shared destination; migrate the owning implementation once.  |
| Pending | `src/app/(modals)/people-search.tsx`     | `~/features/people/PeopleSearchScreen`              | Review neutral groups, typography and shared actions.              |
| Pending | `src/app/(modals)/person-details.tsx`    | `~/features/people/ConversationScreen`              | Alias/shared destination; migrate the owning implementation once.  |
| Pending | `src/app/(modals)/point-of-sale.tsx`     | `~/features/payments/receive/MerchantReceiveScreen` | POS exception: preserve lime/black palette and QR contrast.        |
| Pending | `src/app/(modals)/proofs.tsx`            | `~/features/settings/WalletSettingsScreens`         | Alias/shared destination; migrate the owning implementation once.  |
| Pending | `src/app/(modals)/receive.tsx`           | `~/features/payments/receive`                       | Review neutral groups, typography and shared actions.              |
| Pending | `src/app/(modals)/scanner.tsx`           | `~/features/payments/ScannerScreen`                 | Camera exception: neutral chrome only, preserve scanning contrast. |
| Pending | `src/app/(modals)/search.tsx`            | `~/features/payments/SearchScreen`                  | Review neutral groups, typography and shared actions.              |
| Pending | `src/app/(modals)/send.tsx`              | `~/features/payments/send`                          | Review neutral groups, typography and shared actions.              |
| Pending | `src/app/(modals)/swap.tsx`              | `~/features/payments/swap`                          | Review neutral groups, typography and shared actions.              |
| Pending | `src/app/(modals)/token-details.tsx`     | `~/features/payments/TokenDetailsScreen`            | Review neutral groups, typography and shared actions.              |
| Pending | `src/app/(modals)/txn-details.tsx`       | `Redirect`                                          | Redirect to /txn-details; no independent surface.                  |

## Category-only Settings rows

Settings also has category-only rows without separate route files: Bitcoin symbol, Biometric
app lock, Hide balance, and read-only Nostr health. Review these through SettingsCategoryScreen
and its shared row components; do not count them as existing standalone screens or invent routes
in a styling-only change. Any future navigation/editing split must preserve authentication.

## Onboarding and setup without separate routes

Owner: `src/features/onboarding/index.tsx`. Preserve creation/import, consent, permissions and navigation guards.

- [ ] `src/features/onboarding/WelcomeStep.tsx`
- [ ] `src/features/onboarding/ConsentStep.tsx`
- [ ] `src/features/onboarding/ImportSeedStep.tsx`
- [ ] `src/features/onboarding/PermissionsStep.tsx`
- [ ] `src/features/onboarding/WalletCreationTask.tsx`

## Payment stages and full-screen flows

Review every stage and its loading/pending/success/failure/cancellation states inside the owning flow. Preserve all payment behavior.

### send

- [ ] `src/features/payments/send/AmountStage.tsx`
- [ ] `src/features/payments/send/ConfirmStage.tsx`
- [ ] `src/features/payments/send/NostrSendStage.tsx`
- [ ] `src/features/payments/send/P2PKAmountStage.tsx`
- [ ] `src/features/payments/send/P2PKLockCard.tsx`
- [ ] `src/features/payments/send/PaymentRequestStage.tsx`
- [ ] `src/features/payments/send/ResultStage.tsx`
- [ ] `src/features/payments/send/ScanAndPayStage.tsx`
- [ ] `src/features/payments/send/SuccessStage.tsx`
- [ ] `src/features/payments/send/index.tsx`

### receive

- [ ] `src/features/payments/receive/ConfirmStage.tsx`
- [ ] `src/features/payments/receive/InputStage.tsx`
- [ ] `src/features/payments/receive/MerchantLightningStage.tsx` — POS palette exception.
- [ ] `src/features/payments/receive/MerchantReceiveScreen.tsx` — POS palette exception.
- [ ] `src/features/payments/receive/PosHeader.tsx` — POS palette exception.
- [ ] `src/features/payments/receive/ReceiveResultStage.tsx`
- [ ] `src/features/payments/receive/RequestDetailsEditor.tsx`
- [ ] `src/features/payments/receive/RequestEcashStage.tsx`
- [ ] `src/features/payments/receive/RequestNfcBadge.tsx`
- [ ] `src/features/payments/receive/index.tsx`

### mint

- [ ] `src/features/payments/mint/AmountStage.tsx`
- [ ] `src/features/payments/mint/ConfirmStage.tsx`
- [ ] `src/features/payments/mint/OnchainMintFlow.tsx`
- [ ] `src/features/payments/mint/PaymentStage.tsx`
- [ ] `src/features/payments/mint/ResultStage.tsx`
- [ ] `src/features/payments/mint/index.tsx`

### melt

- [ ] `src/features/payments/melt/InvoiceStage.tsx`
- [ ] `src/features/payments/melt/OnchainMeltFlow.tsx`
- [ ] `src/features/payments/melt/ResultStage.tsx`
- [ ] `src/features/payments/melt/index.tsx`

### Transfer (protocol/stored name: swap)

- [ ] `src/features/payments/swap/AmountStage.tsx`
- [ ] `src/features/payments/swap/ResultStage.tsx`
- [ ] `src/features/payments/swap/index.tsx`

## Shared presentations and screen-owned overlays

These targets do not all have their own route entries. Review their neutral surfaces in every calling flow.

| Area                         | Targets                                                                                                                                                                                  |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NFC                          | src/features/nfc/NfcSheetHost.tsx — reader, payment/receive, pending, result and error states; preserve native behavior.                                                                 |
| Home                         | src/features/home/components/: balance/actions, RecoveryStatusRow, NostrActivity, SupportView. ConnectedMintsCard remains an explicit exception.                                         |
| History and receipts         | src/features/history/components/: transaction/transfer receipts, pending mint/on-chain layouts, notes/details and skeletons. Exported receipts need a separate contrast/geometry review. |
| People and conversations     | src/features/people/components/: profile/people rows, conversation items and payment actions, contact/message sheets. Preserve artwork, unread and message semantics.                    |
| Mints                        | src/features/mints/components/: preview methods/health, overview/details, contacts, terms and QR overlay. Preserve mint artwork and code contrast.                                       |
| Nostr incoming activity      | src/features/nostr/components/NostrPaymentReceived.tsx and NostrClaimSheet.tsx.                                                                                                          |
| Supporter                    | src/features/supporter/SupporterContent.tsx and its Settings route above.                                                                                                                |
| Selection and input sheets   | src/shared/ui/: ActionSelectorSheet, SendMethodSelector, ReceiveModeSelector, ReclaimSelector, HomeMintSelector, InputSheet, InfoSheet.                                                  |
| Shared payment UI            | src/shared/ui/: PaymentStageLayout, PaymentReceipt, PaymentAmount, PaymentMintRow, PaymentStatusRow, PaymentNote, PendingTokenLayout, QR frames/codes.                                   |
| Global states                | src/shared/ui/: LockOverlay, StatusScreen, FirstUseGuidance, toast/operation feedback and startup/loading surfaces.                                                                      |
| Navigation and core controls | Root/tab/Settings headers, HeaderIconButton, CustomTabBar, AppBottomSheet, ListTable, Settings groups/rows, AppButton, AppInput, AppSwitch and AppText.                                  |

## Suggested adoption order

1. Shared groups/lists/fields and Settings: establish one complete reference.
2. Home supporting surfaces (respect connected mints), History and transaction details.
3. Send, Receive, Transfer, Lightning and on-chain flows, one complete flow at a time.
4. Mints, People/conversations and Nostr management/activity.
5. Backup/recovery/security, onboarding, NFC, updates and supporter screens with their additional authentication/native/device checks.
6. POS, camera/QR and export surfaces: apply structure within preserved visual constraints.

Keep routes thin; migrate the owning feature/shared implementation once for all aliases. Check each target off only after reviewing light/dark, larger text, keyboard/safe areas and relevant operation states on a device.
