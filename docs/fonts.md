# App fonts

The app uses **Allo 1.0**, approved after an Android device trial, with two optical designs:

| Role                                          | Tamagui family      | Optical size        | Registered faces                                                 |
| --------------------------------------------- | ------------------- | ------------------- | ---------------------------------------------------------------- |
| Body, UI copy, inputs, buttons and navigation | `$body`, `$heading` | Text (`opsz=14`)    | `AlloTextRegular`, `AlloTextMedium`, `AlloTextSemiBold`          |
| Large text, amounts and balances              | `$display`          | Display (`opsz=32`) | `AlloDisplayRegular`, `AlloDisplayMedium`, `AlloDisplaySemiBold` |

Regular/Medium/SemiBold use weights 400/500/600. Lighter requests map to 400 and
heavier requests map to 600. Only these six static faces are loaded and embedded.
`$mono` is a compatibility alias to Allo Text, not a separately bundled font.
Roundness is restored to **`ROND=0`**, keeping open 6 and 9.
Sizes, weights and tracking remain unchanged. The upstream static OTFs use roundness 50 and
are not the app's source; prepare the faces from `AlloVariable.ttf` instead.

## Number and character features

Both optical families enable these upstream features by default:

- `tnum`: equal-width tabular figures.
- `cv01`: footed 1.
- `cv03`: tailed lowercase l.
- `cv04`: serifed uppercase I.
- `ss03`: restricted to open 6 and 9 in this experiment; 4 keeps its original form.

Zero remains normal and unslashed. `zero`, `ss02`, `cv02` and `cv05` are not
enabled by default. The original Allo outlines are retained; no glyphs are redrawn.
These defaults also apply to native inputs and navigation titles. Existing
`fontVariant={['tabular-nums']}` props remain in place.

The preparation script adds the upstream feature lookups to default-on `ccmp` and
checks with HarfBuzz that default shaping matches the source with the features
explicitly enabled. Applying the same features again is verified to be idempotent.
All six faces have equal digit advances, a footed 1 and a normal zero.

All 29 configured currency labels and Bitcoin are covered. Full-width yen U+FFE5
maps to Allo's existing U+00A5 yen glyph. No other currency outlines are modified.

## Spacing and sizes

Keep the existing rounded 10% size baseline, line heights, weights, control geometry,
accessible text scaling and amount animations. The 20 November spacing adjustment
tightens headings, labels, body text and numbers. The wider trial was rejected.
Current compact trial values:

| Area                                                 | Letter spacing                           |
| ---------------------------------------------------- | ---------------------------------------- |
| 40-point main balances and prominent payment amounts | -0.35                                    |
| Home main balance (44 points)                        | -0.2                                     |
| Amount entry                                         | -0.35 scaled proportionally to font size |
| Bitcoin price                                        | -0.15                                    |
| Nostr detail amounts                                 | -0.2                                     |
| Onboarding headings                                  | -0.15                                    |
| Risk Disclosure heading                              | -0.05                                    |
| Small activity amounts                               | 0                                        |
| Secondary amounts (29 / 25 points)                   | -0.15 / -0.1                             |
| Headings (29 / 22 / 18 points)                       | -0.2 / -0.15 / -0.1                      |
| Labels (14 / 13 / 11 points)                         | -0.05 / -0.03 / 0.02                     |
| Body text (14 / 13 / 11 points)                      | -0.03 / 0 / 0.04                         |
| Brief captions                                       | 0.06                                     |

Button tracking scales from the 14-point label role; native inputs and BUI text
roles use the corresponding shared tracking. Copyable monospaced text retains 0.5.
Rolling-number cells
allow mild negative spacing capped at the balance tracking scaled to their size.
Do not restore the old -1/-1.5 margins or apply a blanket zero-spacing override.
Digit-pair ink bounds were checked across all six faces at the current rolling-number
limit, including the footed 1. Separated digits retain positive ink gaps. Native
text rendering, currency combinations and wrapping still need device review.

## Integration

- Runtime loading: `src/shared/layout/RootLayout.tsx`.
- Native embedding: the six Allo TTF files in the Expo Font plugin in `app.json`.
- Tamagui defaults and weight mappings: `src/tamagui.config.ts`.
- Navigation: `src/shared/layout/RootLayoutNav.tsx`.
- Shared typography: `src/shared/theme/appearance.ts`.
- Shared inputs, BUI controls, amount displays and receipt exports use Allo.

Existing compatible Expo development clients load the fonts at runtime after a
full reload. The next native build embeds Allo and removes old embedded resources;
an installed client can retain its older resources until rebuilt. OS-owned dialogs,
keyboards and share sheets continue to use platform fonts.

## Source, reproducibility and license

Source: [Allo by Josh Puckett](https://github.com/joshpuckett/allo), supplied from
the Allo 1.0 download. `scripts/prepare-allo-fonts.py` pins the variable source hash:

```text
bc26a56fd707fb463f99a51fba67bfb57ab66c341c710efb7419919de9b85330
```

Reproduce with the downloaded variable TTF and its OFL file:

```sh
uv run --no-project --with fonttools==4.67.0 --with uharfbuzz==0.57.0 python scripts/prepare-allo-fonts.py --source <AlloVariable.ttf> --license <OFL.txt> --roundness 0 --open-six-nine
```

The script instantiates Text and Display faces, fixes roundness, sets feature
defaults, checks shaping and writes the six fonts plus `allo-manifest.json`.
The manifest records output hashes, axes, weights, lookup defaults and digit glyphs.
These are isolated build tools; no app dependency is added.

Prepared derivatives use internal names `Bey Allo Text` / `Bey Allo Display` and
the runtime names above. Original font copyright/license metadata is retained.
`src/assets/fonts/Allo-OFL.txt` includes Josh Puckett's copyright, the Inter Project
Authors attribution and the SIL Open Font License 1.1. The fonts remain separately
licensed from the app's AGPL-3.0-only license. Superseded Inter assets, their manifest
and preparation script are removed; Git history retains the previous setup.

## Validation

Asset tests check all six faces, hashes, weights, currency coverage, default feature
lookups, normal zero, footed 1, roundness and native/runtime registration. Rendered
tests check Text/Display weight selection, inputs, buttons and named text variants.

The user approved Allo and the tuned spacing after the Android trial. This is not
a claim that every screen, theme, device size or accessibility scale was tested.
For future changes, check Home, payments, Settings, onboarding, chat, navigation,
native inputs and exported receipts. Review `0123469`, `Il1O0`, currency symbols,
clipping and wrapping in both themes and with larger system text on Android/iOS.
