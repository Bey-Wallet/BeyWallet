# App fonts

Bey uses **TikTok Sans v4.000**, the upstream 16pt optical cut, across UI copy,
headings, balances, inputs, native navigation and receipt images.

| Weight | Asset                     | Expo family          |
| ------ | ------------------------- | -------------------- |
| 400    | `TikTokSans-Regular.ttf`  | `TikTokSansRegular`  |
| 500    | `TikTokSans-Medium.ttf`   | `TikTokSansMedium`   |
| 600    | `TikTokSans-SemiBold.ttf` | `TikTokSansSemiBold` |

These are the only bundled and registered font faces. Lighter requests map to 400;
heavier requests map to 600. `$body`, `$heading`, `$display` and `$mono` all use
these faces. The mono role is technical-text styling, not a separate monospace font.

Tamagui's configuration package retains its own transitive font dependencies in
the lockfile; they are not app font assets or registered runtime faces.

## Numerals and spacing

Tabular numerals are enabled in the prepared font's default substitutions and
rendering props, including rolling balances. Other character features keep the
font's defaults, including the normal unslashed zero. No outlines are redrawn.
Rolling digits measure their actual glyph widths and retain bounded negative
margins. Sizes, line heights, system scaling and control geometry stay unchanged.

| Role                               | Tracking in points  |
| ---------------------------------- | ------------------- |
| Display amounts (44 pt)            | -2.8                |
| Home balance (44 pt)               | -2.8                |
| Primary amounts (44 pt)            | -2.8                |
| Secondary amount summaries (25 pt) | ≈ -1.59             |
| Headings (29 / 22 / 18 pt)         | -0.45 / -0.3 / -0.2 |
| Labels and body (14 / 13 / 11 pt)  | -0.1 / -0.05 / 0    |
| Captions                           | 0                   |
| Copyable technical text            | 0.5                 |

Main balances and amounts use 44-point Medium (500), matching Home, including
confirmations, results, standard inputs, mint balances, Nostr claims and NFC.
Larger POS inputs and receipt-image amounts retain their larger sizes. Tracking uses
`getAmountLetterSpacing(size)`: exactly `-2.8 * size / 44` (table values are rounded).
Small inline rolling balances retain their previous tracking, and explicit zero
remains supported. Headings, list values and button labels are unchanged.

Home's primary balance uses 44-point Medium (500) with -2.8 numeric tracking.
Fiat symbols and codes use the currency formatter's placement and spacing.

## Source, license and preparation

Source: [official TikTok Sans v4.000 release](https://github.com/tiktok/TikTokSans/releases/tag/v4.000).
The derivative is internally named Bey TikTok Sans and preserves upstream copyright
and the SIL Open Font License in `src/assets/fonts/TikTokSans-OFL.txt`.

```sh
python scripts/prepare-tiktok-fonts.py --source <TikTokSans-v4.000.zip>
```

The existing FontTools installation prepares the three static faces, license and
`tiktok-sans-manifest.json`. The source archive hash is pinned. The manifest records
asset hashes, weights, runtime families, default lookups and tabular digit advances.
Preparation and asset tests check the app's currency glyphs, including Bitcoin and
Indian rupee. Unsupported scripts or symbols use native platform fallback.

Expo Font loads the same files in the dev client and native build configuration.
Device checks: both themes, long balances and addresses, currency prefixes,
large system text, keyboard inputs, navigation headers and shared receipt images.
