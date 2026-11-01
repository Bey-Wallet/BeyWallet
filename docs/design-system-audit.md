# Bey foundation audit

Historical baseline recorded before the temporary design preview was removed. Run the audit
command below for the current inventory. The foundation and shared primitives remain.

This phase follows the official Expo `expo-design-system` skill's existing-system audit and
incremental adoption guidance. Bey's Tamagui configuration and approved appearance guidelines
remain authoritative. Source: https://skills.sh/expo/skills/expo-design-system.

## Scope and method

UI source roots: `src/app`, `src/features`, `src/shared/ui`. Token definitions under
`src/shared/theme` and the Tamagui adapter are excluded. The initial inventory covered 300 files
and 42,874 source lines; after the foundation changes it covers 301 files and 42,999 lines.

`scripts/audit-design-system.mjs` uses TypeScript's parser to find literal values in JSX
attributes and object properties. It reports literal hex colors in color properties, numeric
font sizes, nonzero numeric spacing, numeric radii, numeric durations, and legacy shadow
properties. It does not resolve arbitrary expressions, variable indirection, data-driven values,
or token-like strings. It is a candidate inventory, not a claim that every literal is wrong.
Scores are candidates per 100 source lines, rounded to one decimal; 0.0 does not mean zero hits.

## Before and after

| Category                 | Before | After | After / 100 lines |
| ------------------------ | -----: | ----: | ----------------: |
| Color literals           |      6 |     6 |               0.0 |
| Typography literals      |    186 |   186 |               0.4 |
| Spacing literals         |    185 |   156 |               0.4 |
| Radius literals          |     70 |    70 |               0.2 |
| Motion literals          |     17 |    15 |               0.0 |
| Legacy shadow properties |     10 |    10 |               0.0 |

At the end of this foundation phase, the former catalog was no longer the highest source of spacing literals. Typography/radius candidates
remain intentionally untouched outside the affected shared controls; some belong to exported
receipt images, artwork, payment-entry geometry, or approved visual exceptions.

## Foundation findings and changes

1. Colors, typography and geometry already existed in `appearance.ts`; creating another theme
   would duplicate the system. Added a public `~/shared/theme` API while retaining old imports.
2. Button palettes lived inside the config adapter. Moved them unchanged into `theme/buttons.ts`,
   preserving the config's `buttonThemes` export and every generated palette value.
3. Shared control geometry, icon sizes, separator widths, focus metrics, feedback and motion
   values were embedded in consumers. Centralized the values, retaining their existing behavior.
4. Named typography existed, but consumers repeatedly spread role styles manually. Added
   `AppText` and adopted it in Settings rows and the catalog, with Inter face/scaling tests.
5. The former catalog repeated token resolution on every state update. Memoized resolved theme colors
   and filters, and converted its repeated spacing to the source tokens it documents.
6. A recurring 24-point gap had no semantic name. Added `group: 24`; `section` stays 32 to match
   the existing `$section` token. Added `$group` without remapping numeric Tamagui scales.

## Component contract review

| Component                          | Result                                                                                                                     |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| AppButton / AppIconButton          | Existing intent, emphasis, size, pressed, disabled/loading and accessible-name contracts retained; metrics now centralized |
| AppText                            | Named typography/tone, forwarded ref/props, existing Inter face resolution, unrestricted system scaling                    |
| HeaderIconButton                   | 22-point glyph and existing expanded hit target retained                                                                   |
| AppSwitch                          | Existing variants, states, thumb geometry, colors and reduced-motion check retained; duration/touch height shared          |
| Settings groups/rows and ListTable | Existing clipping, density, full-width 2-point separators and row semantics retained                                       |
| AppBottomSheet                     | Existing keyboard/dismissal integration retained; shared existing 250 ms config value                                      |
| Spinner                            | Unmodified                                                                                                                 |

No speculative card/shadow primitive or second button family was added. Platform-neutral brand
decisions, Home mint styling, wallet behavior, and the six prepared Inter faces remain intact.

## Remaining migration targets

- Typography: review receipt-image styles separately from live UI; then Nostr activity/profile,
  People, and mint details. Convert confirmed duplication to AppText one screen at a time.
- Spacing: History, mint amount entry, Add mint, and conversations have the largest candidate
  counts. Match their actual layouts before replacing values.
- Radius: distinguish grouped surfaces from intentional circles, amount inputs, and avatars.
- Shadows: inspect switch thumbs, receipts, and conversation surfaces on devices before changing
  elevation or adopting different native shadow APIs.
- Legacy/inherited color aliases remain registered for compatibility. Do not delete them without
  a complete reachability audit of config, native, script, and UI entry points.

## Visual review

No device/emulator was connected through ADB during this change. Screenshots, large-text wrapping,
keyboard behavior, touch feedback, and light/dark/POS appearance still require device review.
Static token counts and unit tests cannot establish those visual results.

## Validation

TypeScript, structure, and scoped formatting checks passed. Eight focused suites passed 50 tests:
typography (including the new AppText face/scaling checks), appearance, button behavior and themes,
switches, POS sheet themes, UI adapters, and Settings navigation.

The additional header-navigation suite could not load because the existing NFC import path
constructs a NativeEventEmitter without its native module in Jest. Its test, ActionSelectorSheet,
nfcFlow, and nfcService are unchanged; the import also exists in HEAD. The button checker still
reports two pre-existing icon-only AppButton usages in ConnectedMintsCard, which is unchanged.

Run `yarn audit:design-system` for an updated summary, or
`yarn audit:design-system --json` for the complete file/line inventory.
