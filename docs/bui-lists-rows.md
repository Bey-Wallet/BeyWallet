# BUI lists and rows

Open Settings → Advanced → BUI → Lists & rows (`bui-lists`). Values and actions
are synthetic and local. Copy delegates to a callback; this preview does not write
to the clipboard. No wallet, payment, network, mint or saved preference is changed.

Shared implementation in `src/shared/ui/BUI/`:

- `BUIListRow.tsx`: text row, clipped group, overlay divider, check row and header.
- `BUIPropertyRow.tsx`: normal/large properties, copy, descriptions and centered content.
- `BUIListStateRows.tsx`: loading, error, retry and static account skeleton.

`BUIListsScreen.tsx` owns the preview. A thin route, BUI hub, title catalog and
route manifest expose it.

Measurements checked against local Android source revision `70abb50`:
`kmp/ui/src/commonMain/kotlin/ui/components/moon/cell/{BaseTextCell,TextCell,TextCheckCell,TextCopyCell,MoonBundle,MoonPropertyCell,MoonDescriptionCell,MoonTextContentCell,MoonLoaderCell,MoonErrorCell,MoonRetryCell}.kt`,
`moon/{DefaultCellComonentes,MoonDivider}.kt`, core `AccountCell.kt` and ramp `VerticalAssetCell.kt`.

| Family              | Measurements                                                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Base row            | Minimum56; padding16×8; leading gap16; trailing gap8; text gaps2 or0.                                                                |
| Text                | Title16 Medium; subtitle14 Regular/native line height. String title/subtitle default to one line; blank subtitle omitted. Tags gap8. |
| Check row           | Same geometry; blue check28. Checkbox toggles; radio retains selection. Read-only rows have no handler.                              |
| Group               | Margins16/card surface/corners16; square child rows. Divider0.5/start16 with optional extra inset, overlaid without adding height.   |
| Header              | Padding16×12; title16 Medium; description14 Regular; clickable title-chevron gap2.                                                   |
| Property            | Padding19×12; key14 Regular; value14 Medium; gap8; affix gap4; top alignment; single-line middle ellipsis.                           |
| Large property      | Padding16; key16 Regular; value16 Medium; secondary description14; value-description gap2.                                           |
| Copy                | Minimum100; secondary title14; primary value16 Medium/max2 lines; copy glyph24 in48-point touch area. Only copy is interactive.      |
| Description/content | Description padding16/body14/20. Centered heading20/body16/24, horizontal16, gap4.                                                   |
| Account composition | Minimum76; avatar44/badge20; title-tag and price-change gap6. Caller supplies formatted amounts.                                     |
| Compact composition | Minimum52; avatar28/badge14; title-slot gap4; optional check28.                                                                      |
| Loading/error/retry | Minimum72; spinner24; error red label14/max2 lines; retry body14/20/gap12/small36 button.                                            |
| Skeleton            | Minimum76; circle44; title placeholders84×19; subtitle125×20; text gap2. Static.                                                     |

Internal destinations use chevrons; external destinations use an external-link icon.
Read-only status has no navigation cue or press handler. Destructive rows use red.
Disabled callbacks guard taps and long presses. Compact actions retain48-point
touch areas. Interactive property rows grow to at least48; minimum heights expand
with content. Custom slots accept explicit accessibility labels for composed rows.

BUI light surfaces, blue primary, Inter and Lucide are used. Softer light secondary
button fills do not alter list-group surfaces. Preview type sizes and0.5/start16
dividers remain isolated from production Settings lists and its2-point separators.

This matches measured structure, not verified pixel-identical native rendering:
Inter changes glyphs/wrapping; native ripple, island press-scale and animated
shimmer are not reproduced. Android multiline values use tail truncation rather
than unsupported middle ellipsis. Disabled opacity and accessibility growth are
BUI extensions. Full activity/payment rows, cards, advanced feedback and legacy
Android View families remain separate. Android visual, large text, screen-reader
and touch-target review remains necessary.

Tests cover disabled tap/long-press guards, status/blank-subtitle semantics,
checkbox/radio/read-only selection, isolated copy, group removal/empty boundaries
and both appearances across all six categories with local actions.
