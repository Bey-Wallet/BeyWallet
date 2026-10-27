# App fonts

The app uses **Inter 4.1** throughout, with two optical designs:

| Role                                          | Tamagui family      | Optical size        | Registered faces                                                    |
| --------------------------------------------- | ------------------- | ------------------- | ------------------------------------------------------------------- |
| Body, UI copy, inputs, buttons and navigation | `$body`, `$heading` | Text (`opsz=14`)    | `InterTextRegular`, `InterTextMedium`, `InterTextSemiBold`          |
| Large text, amounts and balances              | `$display`          | Display (`opsz=32`) | `InterDisplayRegular`, `InterDisplayMedium`, `InterDisplaySemiBold` |

Regular/Medium/SemiBold use weights 400/500/600. Body text uses 400, labels and buttons
use 500, and headings/amounts/balances use 600. Requests below 400 map to Regular;
requests above 600 map to SemiBold. Existing
sizes, spacing, line heights, scaling and amount animations remain unchanged.

## Number and character features

Both families enable the same upstream OpenType features by default:

- `tnum`: tabular numbers.
- `ss01`: open/alternate digits.
- `ss04`: disambiguation of similar characters, retaining a normal unslashed zero.

These are font defaults, including on native inputs and navigation titles. `zero` and
`ss02` are disabled by default: `ss04` supplies the same disambiguation as `ss02` without
its slashed zero. Relying only on component props would miss some native surfaces.
The prepared fonts include the three upstream feature lookup lists in default-on `ccmp`. The preparation
script verifies with HarfBuzz that default shaping matches upstream shaping with all
three features enabled, and that explicitly enabling them again is idempotent. No
letter or digit outlines are redrawn. This is an intentional app-wide feature policy.

The existing tabular-number props are retained. `$mono` is a compatibility alias to
Inter Text; no separate Mono or Funnel font is registered or loaded by the app.

## Integration

- Runtime assets: `src/shared/layout/RootLayout.tsx`.
- Native embedding: the six Inter TTF files in the Expo Font plugin in `app.json`.
- Global defaults and weight mappings: `src/tamagui.config.ts`.
- Large styles: `appTypography.display`, `.amount`, `.title1`, and H1/H2/H3 defaults.
- Shared payment/amount components, large mint/Nostr amounts, and rolling balances
  explicitly use Display. Smaller secondary values and labels use Text.
- Native bottom-sheet and public-key inputs explicitly use Inter Text Regular.

Runtime loading supports a reload in an existing compatible Expo development client.
A subsequent native build includes the updated embedding configuration. OS-owned
permission dialogs, keyboards and share sheets continue to use platform fonts.

## Source, reproducibility and license

Source: [official Inter 4.1](https://github.com/rsms/inter/tree/v4.1), by the Inter Project
Authors. See the [upstream feature descriptions](https://rsms.me/inter/#features).
The variable source is pinned by SHA-256 in `scripts/prepare-inter-fonts.py`.

```sh
uv run --no-project --with fonttools==4.67.0 --with uharfbuzz==0.57.0 python scripts/prepare-inter-fonts.py
```

This downloads the pinned source into `.tmp/inter-fonts/`, instantiates static Text
and Display faces, sets the feature defaults, and validates their shaping before
writing the six assets and `inter-manifest.json`. The manifest records hashes, optical
sizes, weights, default lookup indexes, tabular advances and the normal-zero glyph.
These are isolated build tools; no app dependency is added.

The prepared derivatives use internal names `Bey Inter Text` / `Bey Inter Display` and
the runtime names above. Original copyright and license metadata are retained.
`src/assets/fonts/Inter-OFL.txt` contains the upstream SIL OFL 1.1 license, separate
from the application's Apache 2.0 license.

Inter's own currency glyphs cover the supported currencies. U+FFE5 (full-width yen)
is mapped to Inter's existing yen glyph because Inter lacks a separate full-width
yen. All other glyph coverage and outlines come from Inter. The former modified
Funnel currency shapes, including the custom rupee, are superseded by Inter.
The obsolete Funnel/Mono binaries, Funnel license, currency-glyph generator and its
fixture have been removed. Only the six active Inter font binaries are bundled.
Stale Basel, TT Firs and Mono copies in the ignored local Android source assets were
also removed and replaced with the six Inter faces. New EAS native projects obtain
the same fonts from `app.json`; existing installed APKs require a rebuild to remove
their old embedded resources.

## Validation and device checks

Asset tests check all six fonts, weights, currency coverage, default feature lookups,
hashes, native embedding and runtime registration. Rendered typography tests check
Text/Display weight selection, inputs, buttons, text variants and amount styles.

Check Home, payment entry/results, Settings, onboarding, chat, navigation, native
inputs, both themes and larger system text on Android and iOS. Review `0123469`,
`Il1O0`, tabular alignment, currency symbols and clipping at row and balance sizes.
Browser/specimen checks and unit tests do not establish native device rendering.

Local checks: font shaping/currency/registration tests and rendered Text/Display weight
tests pass. The browser specimen loaded the prepared faces at 728- and 360-pixel widths,
and measured identical default advances for all ten digits. Typecheck, button and
structure checks pass. Native Android/iOS rendering and accessibility checks remain
pending.

Full regression run after the Home pill and final weight selection: 148 suites / 1,247 tests passed. Three previously reproduced
baseline failures remain: `mint-details-screen` expects a 14-point icon instead of 22;
`mint-url-navigation` lacks the Tamagui pressable mock; `header-navigation` lacks the
native NFC emitter mock. All font, typography, amount and appearance tests pass.

After obsolete-font removal and the seed-import pause correction, the final focused
run passed 98 tests across 15 suites. Typecheck, scoped formatting and structure checks
also passed. The newly added onboarding tests cover pause handoff and failure release.

See [restore and Home acceptance checks](restore-and-home-acceptance.md) for device steps.
