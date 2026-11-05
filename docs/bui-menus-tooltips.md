# BUI menus and tooltips

Open Settings → Advanced → BUI → Menus & tooltips (`bui-menus`). Categories cover
action/selection menus, disabled/destructive options, header overflow, scrolling
menus, arbitrary custom content, icon/text tooltip anchors, short/badged messages,
long clickable explanations and placement controls. All actions update local text;
no clipboard, external link, deletion, setting or wallet operation runs.

Shared files in `src/shared/ui/BUI/`:

- `BUIActionMenu.tsx`: menu trigger, rows and custom-content slot.
- `BUITooltip.tsx`: measured intrinsic bubble width, optional badge, tail and body.
- `useBUIAnchoredPopup.ts`: measured anchor lifecycle, motion and stale-request fencing.
- `popupGeometry.ts`: source-derived tooltip positioning and width caps.

Menus reuse `selectorGeometry.ts` for the same placement/pivot calculation as
existing BUI selectors; the selector components themselves are unchanged.
`BUIMenusScreen.tsx`, the thin route, BUI hub, title catalog and route manifest
expose the new preview.

Measurements checked against local Android revision `70abb50`:
`kmp/ui/src/commonMain/kotlin/ui/components/popup/{ActionMenu,ActionMenuItem,ActionMenuContent,ActionMenuPositionProvider,MoonAnchorTooltip,MoonIconTooltip}.kt`.

| Component      | Measurements / behavior                                                                                                                                      |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Menu surface   | Width cap240, corners20, raised fill, default gap12, start/center alignment, below-first/above fallback.                                                     |
| Menu row       | Height48, horizontal16, label16 Medium/single line, trailing glyph16 in blue, gap8.                                                                          |
| Selected menu  | Radio semantics, selected blue check16 overrides the trailing glyph. IDs distinguish duplicate labels.                                                       |
| Separators     | Height0.5, start inset16.                                                                                                                                    |
| Tooltip        | Gap4, maximum width200 by default, absolute positioning-helper cap288; intrinsic measured text width, body corners12/attention fill/padding12×10, body14/20. |
| Tooltip tail   | Triangle14×6, start inset18 or centered; fixed source tail placement rather than dynamically shifting it along the bubble.                                   |
| Optional badge | Height20/corners4/horizontal5/top4/bottom5/caps10, white fill/attention-colored text, body gap6.                                                             |
| Triggers       | Minimum touch48; info glyph16, labeled-menu glyph20, header overflow glyph22. Labeled triggers use BUI's softer light secondary button fill.                 |

Menu entry: scale .8→1 over120ms cubic(0,0,.2,1), alpha30ms. Exit: alpha75ms,
scale resets after74ms over1ms. Menu pivot follows overlap with the anchor.
Tooltip scale .3↔1 and alpha run150ms; entry cubic(0,0,.2,1), exit cubic(.4,0,1,1).
Tooltip pivot follows the tail. Reduced motion snaps both presentation and dismissal.

Tooltip maximum width follows the source anchor-aware helper (120–288 cap), then
the caller's200/288 limit and measured text width. Above preference flips when it
cannot fit. Tall content scrolls. Tiny viewport bounds additionally prevent a
bubble extending outside the window; unusually short bubbles clamp their tail
inside their width. Native text measurement includes registered Inter font scaling.

Outside tap, Android Back, blur, backgrounding and window/font-scale/theme changes
dismiss. A generation token rejects stale measurement callbacks after dismissal or
unmount. An immediate active-state guard prevents duplicate action dispatch during
exit. Disabled options guard callbacks and keep the menu open. Custom menu content
receives a dismissal function returning whether it initiated the close, allowing
the same guard. Clickable tooltip content records its action then closes visually;
read-only explanations have no artificial button role.

Disabled opacity48%, destructive red, custom content compositions and clickable
tooltip dismissal are BUI extensions around the measured source primitives.
The reference badge explicitly uses white fill, including in light mode; its
contrast still needs visual review before production use.

Native limits: these use transparent React Native Modal. Its focus behavior differs
from the source's non-focusable tooltip Popup. Inter and Lucide replace fonts/icons;
coordinate spaces, insets, RTL tails, focus restoration and screen-reader handling
still need Android verification. No pixel-identical/native-popup equivalence is
claimed. Production menus/navigation and wallet behavior are unchanged.

Tests cover edge/above/narrow-window geometry, duplicate-label selection, disabled
and repeated-tap guards, Back dismissal, stale measurements after background/unmount,
measured short-bubble width, read-only/clickable content, both appearances, custom
content and blur cleanup. Native measurement/press boundaries and motion preference
are mocked; touch placement, focus, long-press and animation require device review.
