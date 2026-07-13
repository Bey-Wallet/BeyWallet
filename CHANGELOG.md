# Bey Wallet — What Changed (Old → Current)

<<<<<<< HEAD
## 🐛 Bug Fixes

- **Removed dead `link` send mode** — Unreachable `sendMode === 'link'` code path removed from SendModalScreen, ConfirmStage, and SendMethodSelector. Relay publishing is handled safely by PendingTokenLayout (reported by @eniyos in #7)
- **False offline detection** — `isInternetReachable: null` (indeterminate) no longer falsely flags user as offline (reported by @eniyos in #7)
- **Settings crash on invalid mint URL** — `new URL()` on malformed mint URLs no longer crashes the Settings screen (reported by @eniyos in #7)


=======
>>>>>>> main
## 🆕 New Features

| # | What | Description |
|---|------|-------------|
| 1 | **On-Chain Bitcoin Deposits** | Top up your wallet via Bitcoin on-chain transactions (not just Lightning) |
| 2 | **On-Chain Bitcoin Withdrawals** | Pay out to any Bitcoin on-chain address directly from ecash balance |
| 3 | **On-Chain Pending Quote Checker** | Auto-checks and resolves pending on-chain mint/melt quotes in the background |
| 4 | **ActionSelectorSheet** | New multi-stage action sheet for Send/Receive/Fund+Withdraw with sub-menus (ecash, lightning, on-chain) |
| 5 | **Offline Denomination Selector** | Pick exact proof denominations for offline NFC sends when swap isn't possible |
| 6 | **Offline Optimization Sheet** | Smart sheet that finds closest subset/overpay/underpay options for offline sends |
| 7 | **Offline Send Utils** | Algorithm to find exact proof subsets, possible amounts, and closest subset options |
| 8 | **Ecash Sharing via Nostr** | Publish encrypted ecash tokens to Nostr relays using NIP-44 v2 + kind 30078 events |
| 9 | **Username Generator** | Deterministic username generation from Nostr pubkey (e.g. "cozypandad202") |
| 10 | **NIP-05 Registration API** | Register `@bey.cash` NIP-05 usernames via signed Nostr proof events |
| 11 | **Hide Balance Toggle** | Tap to hide/show your wallet balance for privacy in public |
| 12 | **Primary Currency Toggle** | Switch between displaying SATS or FIAT as the primary unit everywhere |
| 13 | **Bitcoin ₿ Symbol Toggle** | Option to show ₿ symbol instead of "sats" text |
| 14 | **Seed Backup Reminder System** | Tracks whether seed is backed up + dismissible reminder with cooldown |
| 15 | **Mint Details Screen** | Full dedicated modal for viewing mint info, history, balance, about section, and management actions |
| 16 | **Optimize Wallet Screen** | Consolidation tool to merge small proofs and optimize wallet performance |
| 17 | **Consolidation Service** | New service to merge fragmented proofs into fewer, larger denominations |
| 18 | **Expiry Service** | New service to handle token expiration tracking |
| 19 | **Custom QR Code Component** | Branded QR codes with custom dot shapes, finder styles, and embedded Bey logo |
| 20 | **AppDropdownMenu** | Reusable popover dropdown menu component with haptic feedback |
| 21 | **StatusBadge Component** | Visual status indicator (pending/success/failed/expired/refunded) for transactions |
| 22 | **Custom Tab Bar** | Animated bottom tab bar with sliding indicator and haptic feedback |
| 23 | **Deep Link Handler** | Global listener for `cashu:` and `bey:` deep links to auto-receive/claim tokens |
| 24 | **Network Service** | Offline detection with user-facing alerts before network-dependent operations |
| 25 | **PaymentStatus Component Dir** | Dedicated directory for payment status UI components |
| 26 | **Types Directory** | Centralized TypeScript type definitions (`icon.ts` etc.) |
| 27 | **Kuwaiti Dinar (KWD)** | Added as a supported fiat currency |
| 28 | **Onboarding Consent + Permissions Steps** | New `consent` and `permissions` steps in the onboarding flow |
| 29 | **`qrcode` package** | Added for custom QR code generation (SVG-based) |

---

## 🔧 Enhancements & Improvements

| # | What | Description |
|---|------|-------------|
| 1 | **Currency Service Rewrite** | Cached `Intl.NumberFormat` instances to prevent GC churn during list scrolls |
| 2 | **`formatSats()` added** | Dedicated sats formatter with sign support and optional ₿ symbol |
| 3 | **`formatFiatFromSats()` added** | Direct sats → fiat conversion formatting in one call |
| 4 | **Contact Normalization** | All npubs now normalized on save (handles nprofile1, hex, npub1 formats) |
| 5 | **Contact Migration on Rehydrate** | Existing contacts auto-migrated to normalized format on app start |
| 6 | **Username Normalization** | Strips `@bey.cash` suffix from stored usernames to prevent duplicates |
| 7 | **SQLite WAL Mode** | Enabled WAL journal mode for concurrent reads/writes without locks |
| 8 | **SQLite Performance PRAGMAs** | Added `cache_size`, `busy_timeout`, `temp_store=MEMORY`, `synchronous=NORMAL` |
| 9 | **Lazy DB Initialization** | Database connection now lazy-initialized via `getDb()` instead of eagerly at import |
| 10 | **`closeDb()` helper** | Safely closes the shared SQLite connection for clean shutdown |
| 11 | **Wallet File Service Expanded** | Backup file now 292 lines (was 181) — richer export/import with more data |
| 12 | **Wallet Store Expanded** | 657 lines (was 489) — added on-chain support, spent proof cleaning, keyset progress tracking |
| 13 | **Keyset Restore Progress** | Real-time progress tracking during wallet restore (current/total/keysetId/statusText) |
| 14 | **`cleanSpentProofs()` action** | Checks proof spendability against mint and purges spent ones from local DB |
| 15 | **Settings Store Expanded** | 296 lines (was 192) — added hideBalance, primaryCurrency, seedBackedUp, showBitcoinSymbol |
| 16 | **HomeMintSelector Expanded** | 14,982 bytes (was 11,139) — richer mint picker with more info and actions |
| 17 | **NostrClaimSheet Expanded** | 29,647 bytes (was 18,275) — more robust ecash claiming from Nostr DMs |
| 18 | **Nostr Activity Screen Expanded** | 36,501 bytes (was 28,805) — richer DM and activity views |
| 19 | **Nostr Profile Screen Expanded** | 9,937 bytes (was 7,020) — more profile info and actions |
| 20 | **Scanner Screen Expanded** | 19,108 bytes (was 12,468) — supports on-chain addresses and more token formats |
| 21 | **NFC Receive Screen Expanded** | 13,538 bytes (was 10,256) — improved offline receive flow |
| 22 | **Proofs Screen Enhanced** | 42,391 bytes (was 43,302) — optimized while keeping features |
| 23 | **Mints Screen Expanded** | 31,146 bytes (was 27,410) — added mint detail navigation and management |
| 24 | **HistoryVolume Rewrite** | 6,576 bytes (was 1,751) — now includes cleanup actions for spent proofs and dead invoices |
| 25 | **Toast Component Enhanced** | 4,432 bytes (was 3,876) — improved toast notifications |
| 26 | **ProcessingSheet Enhanced** | 11,985 bytes (was 11,059) — better processing state feedback |
| 27 | **Biometric Service Enhanced** | 1,952 bytes (was 1,628) — more robust auth handling |
| 28 | **NFC Service Enhanced** | 4,325 bytes (was 3,990) — improved NFC communication |
| 29 | **NumericKeypad Enhanced** | 5,644 bytes (was 5,613) — minor UX improvements |
| 30 | **PendingTokenLayout Expanded** | 26,430 bytes (was 19,532) — richer pending token management |
| 31 | **Quotes Service Massively Expanded** | 23,413 bytes (was 6,177) — full on-chain quote support + melt status polling |
| 32 | **Core Proof Service Expanded** | 11,975 bytes (was 5,231) — added spent proof detection and management |
| 33 | **History Service Expanded** | 3,963 bytes (was 1,020) — richer history queries and entry updates |
| 34 | **Core Wallet Service Expanded** | 42,722 bytes (was 32,707) — on-chain flows + offline send improvements |
| 35 | **Nostr Core Service Expanded** | 32,906 bytes (was 26,989) — more DM features and relay management |
| 36 | **Mint Manager Enhanced** | 7,641 bytes (was 6,626) — better keyset repair and mint management |
| 37 | **Search Screen Enhanced** | 14,474 bytes (was 13,915) — improved search UX |
| 38 | **RootLayoutNav Expanded** | 9,738 bytes (was 4,864) — added deep link handling and routing |
| 39 | **RootLayout Enhanced** | 4,288 bytes (was 4,095) — improved initialization flow |
| 40 | **Modals Layout Expanded** | 8,493 bytes (was 7,669) — new screens registered (mint-details, optimize-wallet) |
| 41 | **App Layout Simplified** | 367 bytes (was 436) — cleaner root app layout |
| 42 | **Tamagui Config Expanded** | 179 lines (was 107) — added Mono font, Oswald font, superblue color palette, bold font weight |
| 43 | **SendMethodSelector Enhanced** | 7,064 bytes (was 7,037) — minor improvements |
| 44 | **About Screen Updated** | 9,846 bytes (was 10,012) — streamlined info display |
| 45 | **Ecash Modal Enhanced** | 16,928 bytes (was 18,198) — optimized while keeping functionality |
| 46 | **AppBottomSheet Enhanced** | 4,297 bytes (was 4,091) — improved sheet behavior |

---

## 🆕 Removed / Deprecated

| # | What | Description |
|---|------|-------------|
| 1 | **`cocoService.ts` (725 lines → stub)** | Entire monolithic Coco service gutted — logic moved to modular `core/` services |
| 2 | **`nostrService.ts` (old standalone)** | Deprecated standalone file — replaced by `core/nostrService.ts` |
| 3 | **`nostrStore.ts`** | Removed — was already deprecated in old version |
| 4 | **`services/fixes/` directory** | Removed 4 custom fix files (CustomProofService, CustomReceiveService, CustomSendService, CustomWalletService) |
| 5 | **`modal.tsx` route** | Removed standalone modal route — replaced by proper `(modals)/` group |
| 6 | **ThemeSelector `colorScheme` import** | Removed old 2,349 → 2,294 bytes — cleaned up unused color scheme handling |
| 7 | **LockOverlay old animation** | 5,654 → 4,252 bytes — simplified lock screen overlay |

---

## 🏗️ Architecture Changes

| # | What | Description |
|---|------|-------------|
| 1 | **Monolith → Modular Services** | `cocoService.ts` (725 lines) broken into dedicated services: `walletService`, `proofService`, `quotesService`, `consolidationService`, `expiryService`, `historyService` |
| 2 | **Core Service Layer** | New `services/core/` contains 14 focused service files (was 12), each handling one domain |
| 3 | **Utils Layer Added** | New `src/utils/` with 5 utility modules (was 1) — `onchain.ts`, `offlineSendUtils.ts`, `ecashSharing.ts`, `username.ts`, `time.ts` |
| 4 | **Types Centralized** | New `src/types/` directory for shared TypeScript definitions |
| 5 | **SQLite Lazy Init Pattern** | Database no longer eagerly opened at module import — uses `getDb()` singleton |
| 6 | **Nostr Request Store DB Isolation** | Uses expo-sqlite directly for its own table instead of sharing the Coco DB |

---

## 📦 Dependency Changes

| Change | Package |
|--------|---------|
| ✅ Added | `qrcode` (SVG QR code generation) |
| ✅ Added | `@types/qrcode` |
| ✅ Added | `expo-linking` (deep link handling) |
| 🔄 Same | All other 75+ dependencies unchanged |

---

## 📊 By the Numbers

| Metric | Old | Current | Delta |
|--------|-----|---------|-------|
| Components | 19 files + 3 dirs | 23 files + 4 dirs | **+4 components, +1 dir** |
| Screens | 12 dirs | 14 dirs | **+2 screens** |
| Stores | 12 files | 11 files | **-1 (removed nostrStore)** |
| Utils | 1 file | 5 files | **+4 utilities** |
| Core Services | 12 files | 14 files | **+2 services** |
| Modals/Routes | 28 routes | 30 routes | **+2 routes** |
| Settings Store | 192 lines | 296 lines | **+54% bigger** |
| Wallet Store | 489 lines | 657 lines | **+34% bigger** |
| Quotes Service | 6,177 bytes | 23,413 bytes | **+279% bigger** |
| Tamagui Config | 107 lines | 179 lines | **+67% bigger** |
