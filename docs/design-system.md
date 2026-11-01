# Bey design system

Bey's design system is a mobile foundation built on the existing Tamagui provider. It preserves
the monochrome brand, Inter Text/Display, compact lists, full-width separators, and native wallet
flows. The recorded [surface consistency rules](design-system-proposal.md) and
[screen adoption inventory](design-system-screens.md) guide future visual work.

## Source of truth

Import foundation values from `~/shared/theme`. Existing imports from `appearance.ts` remain
supported. Do not create a second palette, provider, font registry, or parallel control family.

| Layer         | Owner                            | Purpose                                                                     |
| ------------- | -------------------------------- | --------------------------------------------------------------------------- |
| Foundation    | `src/shared/theme/appearance.ts` | Semantic colors, text roles, geometry, interaction and motion values        |
| Button colors | `src/shared/theme/buttons.ts`    | Default, critical and warning palettes and their states                     |
| POS exception | `src/shared/theme/pos.ts`        | Existing local merchant palette                                             |
| Public API    | `src/shared/theme/index.ts`      | Foundation exports for UI consumers                                         |
| Adapter       | `src/tamagui.config.ts`          | Registers those values with Tamagui; preserves bundled defaults and aliases |
| Primitives    | `src/shared/ui/`                 | Reusable component structure, interaction and accessibility                 |

The foundation is independent of `tamagui.config.ts`. Theme modules must not import that config,
UI components, app stores, or wallet services. The adapter consumes the foundation, not vice versa.

## Color roles and themes

For the recorded migration direction, use `$background` for canvas and `$buttonDefaultSecondary`
for neutral groups, fields and secondary actions. Existing `$gray2`/`$gray3` consumers remain until
their screen is reviewed; avoid adding a second neutral fill without a functional reason.
Use `$color` for primary copy, `$gray10` for secondary copy, and `$iconPrimary`/`$iconSecondary`
for icons. Primary brand fills use `$accentColor` with `$onAccent` for the foreground. Buttons
consume their existing `buttonDefault*`, `buttonCritical*`, and `buttonWarning*` state tokens.
Status colors remain semantic; a status fill is not a neutral card color.

Light and dark retain their existing explicit palettes. `light_pos` is the documented merchant
exception. Component subthemes and inherited Tamagui palettes remain registered in the config.
Legacy blue/accent aliases remain for compatibility; use the semantic role for new UI.

## Typography

Use `AppText` for named text roles:

```tsx
import { AppText } from '~/shared/ui/AppText';

<AppText variant="title3">Payment details</AppText>
<AppText variant="body3" tone="secondary">Fees are shown before you send.</AppText>
<AppText variant="display">₿ 128,450</AppText>
```

The default is `body2` (14/20, Regular). `variant` accepts every `appTypography` role. `tone`
accepts primary, secondary, success, warning, or error; default primary. Existing Tamagui text
props and refs are forwarded, with explicit overrides applied after the role defaults.

Inter Text remains the UI family; Inter Display remains the large-title/amount family. The six
prepared static faces and existing Tamagui face mappings resolve 400/500/600 without new font
downloads. Larger/lighter weight requests retain their established mappings. Tabular numerals,
the prepared font features, and system font scaling remain enabled. Do not cap text scaling as a
substitute for wrapping labels or growing a row.

## Geometry and density

| Scale      | Values                                                                  |
| ---------- | ----------------------------------------------------------------------- |
| Radius     | tiny 4, small 8, control 12, card 16, sheet 20                          |
| Spacing    | tiny 2, small 4, compact 8, gap 12, page 16, group 24, section/large 32 |
| Dimensions | action 32, regular row 56, bar 64, touch target 48                      |
| Borders    | outline 1, separator 2, focus 2, focus offset 2                         |
| Icons      | header 22, list 20, navigation cue 18                                   |

Grouped lists clip children at 16-point corners. Separators span the full group width and remain
2 points thick. Compact rows use 14-point labels, 12-point descriptions, and at least 48 points
of touch height. Buttons retain 16-point rounded corners; inputs retain 12. Circular controls,
avatars and pill controls keep their intentional shapes.

`$page`, `$group`, and `$section` map to 16/24/32. The existing `$section` value remains 32;
`large` stays as a compatibility spacing name. Do not remap bundled numeric Tamagui scales as
part of an incidental screen edit.

## Component contracts

| Primitive                       | Contract                                                                                                                           |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `AppButton`                     | Intent: default/critical/warning; emphasis: primary/secondary/ghost/text; sizes: xxsmall/xsmall/small/medium/large; medium default |
| `AppIconButton`                 | Same implementation with an explicit accessible action label; rounded/circular shapes                                              |
| `HeaderIconButton`              | Neutral ghost circle, 22-point icon, existing expanded touch area                                                                  |
| `AppInput` / `AppTextArea`      | Existing Tamagui field semantics with a stable 12-point default radius                                                             |
| `AppSwitch`                     | neutral/branded and primary/secondary; shared reduced-motion behavior                                                              |
| `SettingsGroup` / `SettingsRow` | Compact clipped groups, complete-row targets, selected/navigation/external/read-only semantics                                     |
| `AppBottomSheet`                | Existing native sheet integration, themed surfaces, dismissal and keyboard behavior                                                |
| `Spinner`                       | Existing ring implementation and reduced-motion behavior; unchanged                                                                |

Button geometry is defined once by `appButtonSizes`: visual height/icon pairs are 32/14,
36/16, 40/18, 48/20, and 56/24. All sizes preserve at least a 48-point touch area through the
existing hit padding. Loading retains label geometry and the accessible name, exposes busy state,
and blocks presses. Disabled actions also block presses. Primary fills use the opposite
foreground; text/ghost keep their established interaction semantics. Layout overrides must not
become ad-hoc replacement palettes.

## Motion and elevation

`appMotion` owns the existing switch timing (140 ms), sheet timing (250 ms), and Tamagui
bouncy/lazy/quick configurations. `appButtonStates` owns the established button feedback values.
The spinner is intentionally unchanged. Preserve reduced-motion checks at each animation site.

Bey's default surfaces are flat. No new elevation or shadow scale is introduced without an
actual repeated use. Existing isolated thumb/receipt shadows are tracked as review candidates,
not silently restyled in this foundation change.

## Adoption and review

Use the established component before making a new one. Extract a private composition into shared
UI after it has a clear role and at least two real consumers, with a smaller API than its
implementation. Keep route wrappers thin. Wallet behavior and sensitive operations stay outside
the design-system layer.

Run `yarn audit:design-system` for a candidate inventory, or append `--json` for exact file/line
findings. Candidates require review: artwork, QR codes, optical corrections and animation geometry
can have intentional literals. The audit is informational, not a replacement for accessibility
or visual review. Migrate one screen or complete shared component at a time.

Validation includes Inter rendering, light/dark/POS theme resolution, button state behavior,
switches, full-width groups, reduced motion, large system text and device keyboard/safe areas.
See `docs/design-system-audit.md` for the current baseline and remaining migration targets.
