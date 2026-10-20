# Bey theme foundation

This is an opt-in foundation and development preview. Existing screens, shared controls, theme
preferences, and History's screenshot-based styling have not been migrated.

## Source of truth

Values are pinned to [tonkeeper/android commit
16f00a8a91ad9e47bee33cd0c9cf404a05e89339](https://github.com/tonkeeper/android/tree/16f00a8a91ad9e47bee33cd0c9cf404a05e89339).

- `kmp/ui/src/commonMain/kotlin/ui/theme/dark.kt` and `light.kt`: all semantic color roles,
  including alternate backgrounds, disabled/highlighted button states, fields, overlays, and separators.
- `UIKitTypography.kt`: named text styles, font weights, letter spacing, and OpenType stylistic sets.
- `Dimens.kt` and `ui/uikit/core/src/main/res/values/dimens.xml`: radii, spacing, and dimensions.
- `tests/fixtures/tonkeeper-theme/` retains unmodified color and typography source files for parity
  tests. The upstream repository's license is retained in `docs/third-party/tonkeeper-LICENSE`.

Android `#AARRGGBB` values are converted to React Native `#RRGGBBAA`. Alpha is preserved; overlays
and separators must not be flattened against a particular background.

## Usage

The foundation exports `beyColors`, `beyRadii`, `beySpacing`, `beyDimensions`, `beyTypography`,
`beyThemeNames`, and their TypeScript types from `~/shared/theme/bey`.

```tsx
import { Theme, YStack } from 'tamagui';
import { BeyText } from '~/shared/ui/BeyText';
import { beyThemeNames } from '~/shared/theme/bey';

<Theme name={beyThemeNames.dark}>
  <YStack bg="$beyBackgroundContent" rounded="$beyMedium" p="$beyMedium">
    <BeyText variant="h2">Payment received</BeyText>
    <BeyText variant="body2" tone="textSecondary">
      Example payment
    </BeyText>
  </YStack>
</Theme>;
```

`BeyText` defaults to `body1` / `textPrimary`. `tone` accepts any semantic color role. Standard
Tamagui text props can override its defaults, including color, accessibility labels, and numeric
font variants. Use it within `dark_bey` or `light_bey` so all semantic tones are available.

Color tokens use a `$bey` prefix: `$beyTextPrimary`, `$beyIconSecondary`, `$beyFieldErrorBorder`, etc.
Radius and spacing tokens are namespaced too. Numeric tokens such as `$6` retain their current values.
Existing `dark` and `light` palettes and button aliases retain their current values. Only the scoped
new themes override generic background, foreground, border, and accent aliases. Their `blue10`
alias also matches the source accent so the existing keyboard focus ring uses the right color.

## Typography

| Role                     |         Size | Weight | Explicit line height |
| ------------------------ | -----------: | -----: | -------------------: |
| num1 / num2              |      32 / 28 |    500 |       Native metrics |
| h1 / h2 / h3             | 32 / 24 / 20 |    700 | Native / 32 / native |
| label1 / label2 / label3 | 16 / 14 / 12 |    500 |       Native metrics |
| body1 / body2 / body3    | 16 / 14 / 12 |    400 |     24 / 20 / native |
| body4CAPS                |           10 |    500 |       Native metrics |
| mono                     |           16 |    500 |                   24 |

Body and label tracking is 0.005 em, except the 12-point and caps styles, which use 0.01 em.
Mono tracking is 0.5 points. Heading/number styles enable ss09, ss17, and ss18; text styles
also enable ss07. Native uses stylistic `fontVariant` values. On web, the adapter translates those
values into CSS `fontFeatureSettings`, selects the correct bundled font face, and disables synthetic
weights. React Native Web otherwise emits the native stylistic names as unsupported CSS values.
Native font scaling remains enabled. The caps role does not transform content; callers supply uppercase
labels when appropriate, matching the upstream TextStyle behavior.

The existing TT Firs Neue normal, medium, and demi-bold assets are byte-for-byte identical to the
pinned source. They are reused. Roboto Mono is added as `BeyRobotoMono`; the old `Mono` family remains
available. Both Expo runtime loading and the native font plugin register the additional asset.

Roboto Mono's embedded notice: “Copyright 2015 Google Inc. All Rights Reserved.” It identifies
Apache License 2.0 as its license; the repository's `LICENSE` contains that license text. Its upstream
Git blob hash is `b158a334eb372a9ab2ecd4f2566e60d561e71a9f`.

## Preview

In a development build, open **Settings → About → Theme preview**. Select Dark or Light to inspect
surfaces, synthetic activity cards, all text roles, button states, fields, radii, color swatches, and
the existing spinner. Changes remain local to the preview; no settings or wallet data are written.
The About entry is absent in production; direct access redirects to About without mounting preview
content. Normal onboarding, authentication, and wallet initialization still apply.

Preview buttons are local examples built with `AppPressable`, not replacements for production
`AppButton`. The existing spinner implementation, motion curve, geometry, sizes, and reduced-motion
handling are unchanged. Small source-sized controls still need Bey's 48-point minimum touch target.

## Later migration

Migrate shared controls first, keeping their existing APIs and behavior. Then migrate one feature at
a time to semantic tokens and named text roles, reviewing light/dark screenshots and large text at
each step. Replace History's feature palette only during its explicit migration; retain LegendList,
its layout, and detail-only status checks. Keep Settings list structure confined to preference and
navigation lists. Do not change wallet operations as part of a theme migration.

Before global activation, review system bars, modal surfaces, inputs, keyboard interactions,
accessibility, disabled/pressed states, and glyph rendering on Android and iOS. Enable the new
theme at the provider only once the feature rollout is complete. Do not replace the loading spinner.
