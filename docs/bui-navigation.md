# BUI headers and navigation

Open Settings → Advanced → BUI → Headers & navigation (`bui-navigation`). Categories:
Headers, Scrolling and Navigation. Tabs and a nested sample flow use component state;
the real Expo/Settings navigation, tab bar and wallet behavior remain unchanged.

Shared implementation in `src/shared/ui/BUI/`:

- `BUIHeader.tsx`: centered/simple/modal headers, action circles, notification icon,
  measured title fitting and collapsing large title.
- `BUINavigation.tsx`: bottom tabs and gradient-backed bottom action container.
- `navigationGeometry.ts`: source title fitting/gutters and clamped large-header height.

`BUINavigationScreen.tsx` owns preview controls and local flows. The thin Settings
route, BUI hub, title catalog and structure manifest expose it.

Measurements checked against local Android revision `70abb50`:
`kmp/ui/src/commonMain/kotlin/ui/components/moon/MoonTopAppBar{,Simple,Modal,Large}.kt`,
`MoonBottomBar.kt`, `DefaultCellComonentes.kt`, and
`ui/uikit/core/src/main/{java/uikit/widget/BottomTabsView.kt,res/layout/view_bottom_tab.xml}`.

| Component            | Source measurements / BUI presentation                                                                                                                          |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Centered header      | Content64, centered heading24/32, caller-supplied controls.                                                                                                     |
| Simple header        | Content64, horizontal16, heading20, optional subtitle14/20 Medium.                                                                                              |
| Modal header         | Content64, horizontal16, heading20, subtitle container20/label14 Regular with native line height, updating spinner12/stroke1.5, optional full-width divider0.5. |
| Action control       | Visual circle32, expanded touch48. BUI-approved glyph22; source artwork is typically16. Uses softer light secondary button fill.                                |
| Notification control | Touch48, semantic red dot6/corner strategy; BUI glyph22 replaces source28.                                                                                      |
| Title centering      | Reserve the larger measured side group on both sides, plus4-point title spacing and16 outer padding. Navigation circle32 has a16-point trailing spacer.         |
| Title fitting        | Optional measured width, repeatedly ×.95 down to.85, then single-line ellipsis. Width/text changes recompute fitting.                                           |
| Large header         | Expanded84→0, horizontal16, heading32 bottom-aligned/clipped; physical-pixel height rounding.                                                                   |
| Bottom tabs          | Content64 plus bottom inset, horizontal16, equal-width visible tabs, icon28/label12 Medium/gap4; active blue/inactive tab palette.                              |
| Bottom action bar    | Content84 plus bottom inset, horizontal16/gap12; gradient transparent at0→page at.7; unique SVG ids.                                                            |

Back and close stay on the left: ArrowLeft returns a step; X dismisses the embedded
standalone root. Header title/action fade and subtitle height/fade use180ms
cubic(.4,0,.2,1), with reduced-motion snapping. Hidden title actions immediately
disable interaction and screen-reader exposure. Header actions can be absent or
custom multi-control groups. Read-only titles expose a heading; clickable titles
have an explicit label. Disabled action callbacks are guarded.

Bottom tabs select by id, support independent long press, unread state and hidden
items. Hidden items leave layout and the accessibility tree. Insets are explicit
component inputs defaulting to0: the embedded24-point sample reserves them once.
Production consumers should assign safe-area ownership at the screen/container
boundary rather than adding these insets twice.

Source limits: React Native reproduces measured structure rather than Material's
native layout engine. Inter/Lucide replace fonts/artwork, and22-point header glyphs
follow Bey's approved convention. Native ripple, Lottie tab icons, Material
nested-scroll physics, snapping and status-bar treatment are not ported. The large
title maps scroll offset directly to the source0–84 height range. Measured title
fitting uses native Inter glyph widths; it is not pixel-identical to source fonts.
Material-centered controls share BUI's centered gutter layout. Android visual,
font-scale, accessibility, scroll and device-inset review remains necessary.

Tests cover fitting bounds/centering, hidden title callback guards, action removal,
duplicate-label tab ids, hidden tabs, independent long press, unique gradients,
both appearances/categories, insets and sample back/close/reopen transitions.
