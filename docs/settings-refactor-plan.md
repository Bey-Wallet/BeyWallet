# Settings refactor — approval draft

Status: approved and implemented; device verification remains outstanding.

Settings explicitly registers `index` before the protected development-only BUI screens,
and its tab entry targets that index. Recovery opens the root `/recover-funds` modal with
a vertical slide transition and dismisses to Home when idle. Its former Settings URL
remains a compatibility redirect, including the selected mint. Operation guards remain active.

## Experience

- Use the three Phantom screenshots as references for hierarchy, spacing, rounded
  groups, fine dividers, profile card, and the About screen. Keep Bey's fonts,
  monochrome branding and theme-aware light and dark surfaces.
- Use Tamagui `rounded="$6"` for grouped list containers, the profile card,
  and Settings content cards, following the app's standard. Child rows inherit
  the group's clipped corners; do not round each row separately. Preserve the
  approved switch's pill shape and existing circular avatar/icon-button shapes.
- Use `$gray10` for muted text, `$gray2` for neutral card backgrounds, and `$gray3`
  for hover/press feedback. Keep warning/error surfaces semantic.
- List dividers span the entire card width, including below leading icons, and
  use a thickness of 2 points.
- Center the Settings title and show a back arrow. Hide the app's bottom tab bar
  on Settings and every descendant screen. Preserve the device's system navigation.
- Keep the Settings entry in the tab bar on other tabs. Back from Settings returns
  to the previously selected non-settings tab, with Home as the direct-entry fallback.
- Use a profile card above the grouped list, with the existing avatar and resolved
  username. Provide a public-key fallback when there is no claimed username.
- Main rows navigate; they never toggle a preference, launch authentication, open
  a file picker, or perform a wallet operation directly. Show concise current values
  and chevrons. Use external-link icons only for external destinations.
- Bitcoin symbol, hide balance, and biometric app lock use inline category switches,
  following the approved interaction update. Other preferences and operations use
  dedicated screens for selection lists, explanatory text, and action buttons.
  Existing profile forms may keep related fields together on their dedicated screen.
- Use the approved AppSwitch: neutral/branded variants and primary/secondary
  emphasis. Use branded primary for normal preference toggles.
- Prefer rows at least 48 points high, scalable text, accessible labels, and
  sufficient contrast. Longer labels grow vertically rather than clipping.

## Icons and interaction cues

Use the existing `@tamagui/lucide-icons` family and Bey/Nostr brand assets.
Choose icons by purpose, with consistent 20–22 point sizing and stroke weight
for list rows. Keep leading icons aligned in a fixed-width slot. Pair icons with
clear labels; color alone must not communicate meaning.

| Destination         | Leading icon         |
| ------------------- | -------------------- |
| Profile & addresses | Existing user avatar |
| Appearance          | SlidersHorizontal    |
| Notifications       | Bell                 |
| Privacy & security  | ShieldCheck          |
| Backup & recovery   | DatabaseBackup       |
| Payments & mints    | Wallet               |
| Network             | Network              |
| Wallet tools        | Wrench               |
| Help & support      | CircleHelp           |
| About Bey Wallet    | Info                 |

Verify each named icon export against the installed package during implementation;
use its closest semantic equivalent if needed without adding a dependency.
Leaf screens use specific icons: Palette for theme, Coins for display units,
Banknote for fiat currency, Bell for notifications, Fingerprint for biometric lock,
EyeOff for hidden balance, Landmark for mints,
Network for relays, HeartPulse for health, and ShieldCheck for proof verification.
Use FileUp for backup export and FileDown for backup restore, always paired with
explicit action labels. Reserve Trash2 and destructive red for wallet deletion.

Trailing cues are consistent: ChevronRight for internal navigation, ExternalLink
for web destinations, and Check for the selected option on a detail screen.
Show current values before chevrons in subdued text. Use a left arrow for Back,
with an accessible label. Make the entire row tappable, keep dividers subtle,
and provide pressed/focus feedback with the app's existing interaction components.

## Main list and complete existing-feature mapping

The profile card opens Profile & addresses. Home groups Appearance and Notifications;
Payments & mints, Privacy & security, and Backup & recovery; Network and Wallet tools;
then Help & support, Support Bey, and About Bey Wallet. Notifications opens directly.
Existing category URLs remain valid. Bitcoin symbol is an inline switch in Appearance;
hide balance and biometric app lock are inline switches in Privacy & security.
Other actionable category rows navigate. App lock authenticates changes in both directions.

The following hierarchy defines the current mapping. Semicolons separate
nested list groups; items within each group retain the order shown.

| Destination         | Ordered content                                                                                          |
| ------------------- | -------------------------------------------------------------------------------------------------------- |
| Profile & addresses | My addresses, Nostr username, public Nostr key                                                           |
| Appearance          | Theme, fiat currency, Bitcoin symbol                                                                     |
| Notifications       | Existing notification preferences                                                                        |
| Payments & mints    | Connected mints, Lightning address, prepare offline change                                               |
| Privacy & security  | Biometric app lock, hide balance; receiving from people, blocked people; Nostr secret key; Delete wallet |
| Backup & recovery   | Recovery phrase, mint-list backup, export wallet backup; restore wallet backup, recover funds            |
| Network             | Relays, Nostr history, read-only Nostr health                                                            |
| Wallet tools        | Optimize wallet; proof manager, verify proofs offline; development-only BUI                              |

Lightning address retains its receiving-mint and pending-payment screens. Recovery, key handling, backup formats,
authentication, and wallet operation semantics remain unchanged.

Help & support retains documentation and issue-report links. Support Bey retains
the existing supporter screen. About retains version/build, App updates, website,
GitHub, and the combined Terms & privacy policy link.

Keep public-key and secret-key destinations distinct.
Preserve entry points from outside Settings, including profile, mint management,
backup warnings, onboarding, and payment flows.

## Proposed additions and exclusions

- Surface the existing hide-balance preference in Settings; its persistence already exists.
- Add navigation and explanatory screens for existing functionality before adding
  new behavior. Per-event notification controls remain a separate new feature.
  Relay editing was subsequently approved and implemented with persisted URL
  validation, add/remove controls, default reset, and live connection dots.
- Language is currently an inactive placeholder. Do not ship an inert row. Add a
  dedicated language selector only with real localization support in a later phase.
- Possible later additions: settings search, haptic preference, configurable lock
  timeout, notification categories, backup-location management,
  and sanitized diagnostic sharing. These require individual scope approval and
  implementation; they are not part of the initial navigation/UI refactor.
- Do not copy Phantom's Manage Accounts, Active Networks, or Connected Apps rows:
  corresponding multi-account, chain-selection, and dapp-connection features have
  not been established in this audit. People remains the main address-book entry.
- Verify existing support/website destinations during implementation. Terms and
  Privacy require real, approved URLs; do not invent legal content or destinations.

## Navigation and implementation boundaries

- Replace `src/app/(tabs)/settings.tsx` with a nested `settings/` route directory:
  `_layout.tsx`, `index.tsx`, category indexes, and named leaf routes.
- Keep the nested stack's header in charge of the centered title and back actions;
  suppress the outer tab header for Settings to prevent duplicate headers.
- Update the custom tab-bar render boundary to return no bar when Settings is active.
  Merely setting `tabBarStyle.display` is insufficient: CustomTabBar renders its own UI.
- Keep Expo routes thin. Screen implementations and configuration belong under
  `src/features/settings/`, with reusable primitives in `src/shared/` only as needed.
- Reuse existing wallet, platform, mint, Nostr, and persistence services. Extract
  existing Settings operation handlers into feature hooks where needed. Do not
  introduce dependencies or change lifecycle service boundaries.
- Reuse existing non-settings feature screens through an appropriate shared screen
  boundary. Preserve legacy routes where other features still navigate to them.
- Migrate settings-specific sheets and inline edits to full screens. Show operation
  progress/errors/results there; retain explicit destructive confirmations and
  native authentication/file-picker UI when required.
- Delete obsolete sheets only after checking all imports and external entry points.
  Update the structure-check route manifest when routes change.

## Security and behavior preservation

This refactor changes navigation and presentation. Preserve seed/key derivation,
backup formats, restore semantics, mint approval, receiving-policy effects,
proof validation, and authentication requirements. Any proposed change to those
behaviors needs separate explanation and approval before implementation.

Protect sensitive leaf screens when entered directly, not only when reached from
the main list. Keep secrets out of route parameters, logs, previews, and screenshots.
Re-hide sensitive content on screen exit/background. Verify how these requirements
interact with existing authentication and lock handling before migration.

## Delivery phases

1. Approve the information architecture, screenshot interpretation, and initial
   feature scope. Resolve missing external/legal links before enabling them.
2. Build the nested Settings navigation, header/back behavior, grouped main list,
   profile card, and About screen. Present these for visual review.
3. Migrate Preferences and Notifications, preserving persistence and using AppSwitch.
4. Migrate Security, Backup, Wallet operations, and Nostr destinations with their
   existing authentication, confirmations, progress, and result handling.
5. Remove unreachable settings sheets, verify old entry points, and complete checks.

## Acceptance checks

- Main Settings has no inline mutations or action sheets. Category lists expose
  the three approved inline switches; other actionable rows navigate to leaf screens.
- Group and card corners use `$6`; icon meanings, alignment, sizes, navigation
  cues, and row hit targets remain consistent across main and nested screens.
- Header, Android back, swipe-back where supported, tab return behavior, and
  direct/deep-linked destinations behave consistently. No double header or tab-bar flash.
- Row values update after returning from leaf screens; persisted preferences survive restart.
- Focused tests cover navigation boundaries, controlled switch behavior, blocked
  actions while busy, authentication rejection, and sensitive direct-entry gates.
- Run relevant Jest tests, `yarn typecheck`, `yarn check:structure`,
  `yarn check:buttons`, and formatting checks for changed files.
- Device checks cover biometrics, notifications, import/export/cancellation,
  recovery/private-key reveal, delete confirmation, offline operations, and
  navigation to/from payment or mint screens. Use a disposable test wallet for
  destructive flows. Capture UI review screenshots without secrets.
- Check light/dark themes, small screens, large text, screen-reader labels,
  reduced motion, and scroll-position retention.

## Approval scope

Phases 2–5 were approved and implemented. Optional new behaviors remain outside
that scope. The new Settings tree uses thin route
wrappers, inline switches for Bitcoin symbol, hide balance, and app lock, and
dedicated screens for other settings. Existing public entry points
for recovery and Nostr settings remain available. Terms and Privacy share the
existing published `https://bey.cash/privacy-policy` page, verified during implementation.

The follow-up simplification replaces the old Proof Manager with a minimal list
for mint/state filtering, refresh, export, and confirmed spent-record cleanup.
Individual token creation and ready-proof deletion are no longer exposed there.
Nostr health is a read-only overall status row rather than a separate clickable
screen. Updates and Username use simple text, lists, and actions without hero cards.

Automated checks and remaining device checks are recorded in
[settings-verification.md](settings-verification.md).
