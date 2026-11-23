# App fonts

Bey uses **Inter 4.1 at its default optical size, `opsz=14`**, throughout UI copy,
headings, inputs, native navigation, balances, amount entry and receipt images.
The upstream standard Inter faces use its default optical-size cut.

| Weight | Asset                | Runtime family  |
| ------ | -------------------- | --------------- |
| 400    | `Inter-Regular.ttf`  | `InterRegular`  |
| 500    | `Inter-Medium.ttf`   | `InterMedium`   |
| 600    | `Inter-SemiBold.ttf` | `InterSemiBold` |

`$body`, `$heading`, `$display` and `$mono` use these same three faces. Lighter
requests map to 400 and heavier requests map to 600. `$mono` is a compatibility
role using Inter, not a separate monospace font.

## Character features

- **Tabular numerals are enabled.** Native text requests `tabular-nums` and
  SVG receipts request `tnum`.
- `cv01` is disabled; use the normal upstream 1.
- `ss02`: disambiguation, with **all zero substitutions removed**. Uppercase I,
  lowercase l and related characters use the upstream disambiguation shapes.
- Normal punctuation; `ss07` square punctuation is disabled.
- `cv02`, `cv03` and `cv04`: open 4, 6 and 9, including tabular numeral forms.
- Zero stays normal and unslashed; no dotted-zero alternate is enabled.

The preparation script adds the selected lookup indexes to default-on `ccmp`.
The selected substitutions are checked to be idempotent. The `tnum` feature is
included in default lookups; normal zero is retained. No glyph outlines are redrawn.
Prepared font name records identify the derivatives as Bey Inter; original
copyright and license metadata is preserved.

## Spacing

Sizes, line heights, weights, control geometry and text scaling are unchanged.
Numeric tracking is
calibrated for its glyphs and currency prefixes. Tracking is in points:

| Role                              | Tracking            |
| --------------------------------- | ------------------- |
| Display (40 pt)                   | -0.9                |
| Home balance (44 pt)              | -1.4                |
| Amounts (29 / 25 pt)              | -0.65 / -0.55       |
| Headings (29 / 22 / 18 pt)        | -0.45 / -0.3 / -0.2 |
| Labels and body (14 / 13 / 11 pt) | -0.1 / -0.05 / 0    |
| Captions                          | 0                   |
| Copyable technical text           | 0.5                 |

Amount-entry tracking scales from the display role. Rolling digits keep their
measured cell widths and bounded negative margins. Unspecified tracking inherits
the numeric role; explicit zero remains supported. Small rolling balances scale
from the 25-point amount role. Labels and body text do not inherit amount tracking.

## Source and preparation

Source: [Inter 4.1](https://github.com/rsms/inter/releases/tag/v4.1), using
`extras/ttf/Inter-{Regular,Medium,SemiBold}.ttf` from `Inter-4.1.zip`.
The archive hash is pinned in the preparation script. The retained license is
`src/assets/fonts/Inter-OFL.txt`, separate from the app's AGPL license.

```powershell
python scripts/prepare-inter-fonts.py --source C:\path\to\Inter-4.1.zip
```

The script uses the existing FontTools build tool, checks the source archive,
applies the approved defaults, verifies equal digit advances, normal 1 and normal zero, then
writes the three fonts, license and `inter-manifest.json`. The manifest records
source/output hashes, weights, default lookups and selected glyphs.

## Integration and validation

- Runtime loading: `src/shared/layout/RootLayout.tsx`.
- Native embedding: the same three files in the Expo Font plugin in `app.json`.
- Family/weight mappings: `src/tamagui.config.ts`.
- Role tracking: `src/shared/theme/appearance.ts`.
- Asset/default-feature tests: `tests/unit/font-assets.test.ts`.

Asset and typography tests check hashes, weights, character coverage, selected
features, tabular figures, normal 1, normal zero, registration, weight resolution and native text scaling.
Font-file spacing checks cover numeral pairs, punctuation and currency prefixes.
Review native rendering, wrapping and exported receipts on device in both themes
and with larger text. Inter includes Bitcoin and Indian rupee; full-width yen may
use platform fallback. No currency glyph aliases are added.

After changing the prepared files, fully close and reopen the development client
to clear native font caches. No new native build is needed for runtime previews;
the next build embeds these same three faces. OS dialogs, keyboards and share
sheets keep their platform fonts. Superseded font assets and build tools are not
bundled; Git history retains earlier setups.
