# BUI tabs, chips and selectors

Open Settings → Advanced → BUI → Tabs, chips & selectors. Route:
`src/app/(tabs)/settings/bui-tabs-chips.tsx`. Selections are local synthetic examples;
no wallet, mint, currency or network preference is changed.

Measurements checked against local Android source revision `70abb50`:
`kmp/ui/src/commonMain/kotlin/ui/components/moon/{MoonContentTabs,MoonChips,MoonOutlineChip,MoonTags,MoonActionSelector}.kt`,
`ui/components/popup/{ActionMenu,ActionMenuContent,ActionMenuItem,ActionMenuPositionProvider}.kt`,
and `ui/theme/{Dimens,Shapes,UIKit}.kt`.

| Component                     | Matched geometry and presentation                                                                                                                    |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BUIContentTabs`              | Track40/R20/padding4; pill32/R16/card fill; equal segments, label14/500, horizontal16. Empty reserves40; missing selection falls back to first item. |
| `BUIChip`                     | H32/R16, horizontal12; image variant start6/end12/image20/gap6; label14/500; neutral attention selected fill.                                        |
| `BUIChipBar`                  | Sides16/top8/bottom16/gap6. Single id selection; reveal clipped selections on tap and optionally external changes.                                   |
| `BUIOutlineChip`              | R16, border1.5, padding12×6, natural text height, single-line label14/500; selected raw neutral tertiary fill.                                       |
| `BUITag` / `BUITags`          | H32/R16, padding16×8, optional icon16/gap8, label14/500/ellipsis; wrap gaps8.                                                                        |
| `BUIActionSelector` Secondary | H32/R16/padding12/gap6/label14/500/optional icon16.                                                                                                  |
| `BUIActionSelector` Tertiary  | H36/R20/padding16/gap8/label14/500/switch icon16; raw neutral tertiary fill.                                                                         |
| Selector popup                | Width cap240/R20/raised surface, rows48/padding16/gap8/label16/500/check16 blue, separators0.5 inset16.                                              |

The source distinguishes `Shapes.large` (20) from `UIKit.shapes.large` (16).
Selectors use the former; outline chips and the tab pill use the latter.
Selectors and outline chips retain the raw tertiary fill rather than BUIButton's
transparent tertiary background. Chip selection is neutral, as in the source;
the popup check uses BUI blue. Light surfaces retain the white-page adjustment.

Tab movement uses200ms cubic(.4,0,.2,1). Chip fill uses a critically damped spring
with stiffness1500. Popup entry uses scale .8→1 over120ms cubic(0,0,.2,1) and alpha30ms;
exit fades75ms then resets scale after74ms. Transform origin follows the anchor/menu
overlap. Placement is below-first, then above, centered by default, with optional
start alignment and12-point offset. Horizontal clamping follows the source's zero
start/16 end margins. Oversized menus scroll within the viewport.

Outside tap, Android Back, selection, navigation blur, backgrounding and window/theme
changes dismiss the menu. Pending native measurements are invalidated on cleanup.
IDs distinguish duplicate titles. Empty selectors do not open a popup. Multi-select
chips and read-only tags are BUI compositions.

Compact visuals retain at least48-point touch targets through hit areas. Reduced
motion snaps animations and scrolling. Inter and Lucide remain BUI substitutes,
so glyph metrics, natural outline-chip height, wrapping, ripple and native popup
focus are not pixel-identical to Compose. React Native's scrolling and animation
engines also differ. Android visual review remains; pixel equivalence is unverified.
The deprecated chip-bar API is omitted.

Tests cover popup edge clamping, conditional chip scrolling, duplicate IDs, fallback
tabs, both appearances/categories, chip selection, neutral fills, menu selection,
dismissal and stale measurement callbacks after backgrounding.
