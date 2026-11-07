# BUI sheets and dialogs

Open Settings → Advanced → BUI → Sheets & dialogs (`bui-sheets`). Live sheet samples:
information, plain selection, keyboard form, scrolling content and a three-step
flow. Dialog variants: one action, two actions, destructive, message-only, long
content and long labels. All data/actions are synthetic and local.

Shared components in `src/shared/ui/BUI/`:

- `BUISheet.tsx`: BUI themed wrapper around `AppBottomSheet`; imperative present/
  dismiss API; BUI header, Gorhom scroll view and safe-area content padding.
- `BUISheetInput`: existing BUI field with `BottomSheetTextInput` keyboard integration.
  A ref adapter normalizes Gorhom's optional Gesture Handler input ref to the native
  input contract. Ordinary `BUIInput` still defaults to native TextInput; the new
  input-component slot does not change ordinary fields.
- `BUIDialog.tsx`: presentational alert content and a controlled native Modal host.

`BUISheetsScreen.tsx` owns preview state. Thin route, BUI hub, Settings titles and
structure manifest expose it. No wallet, permission, authentication, backup,
payment, network, clipboard or persistence operation runs.

Measurements checked against local Android source revision `70abb50`:
`kmp/ui/src/commonMain/kotlin/ui/components/moon/dialog/{MoonAlertDialog,MoonModalDialog}.kt`
and the previously measured BUI header/button/list/input families.

| Alert role | Measurements                                                                                                                           |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Surface    | Corners20, source Android elevation8, page background.                                                                                 |
| Content    | Padding16 horizontal/24 vertical, optional heading20, primary message14/20, centered text, title-message gap8 (omitted without title). |
| Divider    | Horizontal0.5. No vertical action divider.                                                                                             |
| Actions    | Equal widths, minimum56, label16 Medium, primary text by default; destructive red is explicit. Long labels may grow.                   |

Live dialogs cap width at560 with24-point side clearance plus safe areas; content
scrolls within the viewport. The host uses BUI overlay color and reduced-motion-aware
fade. Action callback precedes dismissal; repeated taps during closing are ignored.
Android Back/outside tap dismiss without an action. Native focus, shadows, transition
and host width differ from Material BasicAlertDialog and require device review.

Live sheets retain the approved shared host:36×4 handle,20-point corners, backdrop,
gesture/Back dismissal, keyboard behavior and animations. Sheets fit their default
content, capped at viewport height minus the top safe inset (at least24 points).
A single Gorhom scroll view owns sizing, including the header and content padding.
Content uses16-point side padding plus side safe insets,12 points below the header,
and16 points plus the bottom safe inset. Padding is applied once; longer content
scrolls only when it exceeds the cap, without a visible scroll indicator. Both host
and portal content receive the selected BUI theme. `canDismiss` is passed through
and guards ref/header dismissal too; production operation/authentication guards
are unchanged.

Production sheets use the same BUI header and geometry through the `title` API on
`AppBottomSheet`; `BUISheet` additionally scopes the BUI preview theme. Pass
`headerActions`, `navigation` and `onNavigate` for header actions or intermediate
steps, and retain the owning flow's `canDismiss` guard. Do not add another heading,
outer padding, scroll view, bottomInset or fixed percentage snap point at call sites.
The mint selector keeps a virtualized Gorhom list with its header inside the measured
list content. Active transaction layouts keep their own scrolling and footer.

This does not recreate the native reference container: its View sheet has16-point
top corners and different parent-scale/entry/predictive-back behavior; its Material
sheet hides the drag handle. BUI reuses `AppBottomSheet` as required, composing
measured content inside it. Deprecated scaffolds/right-close layouts are omitted.

Selection/name drafts commit only through explicit actions. Cancel/reopen restores
saved sample values. Blank names are blocked;40-character cap is a demo constraint,
not a wallet rule. Intermediate headers use ArrowLeft; roots/finished steps use X.
Native sheet Back dismisses the sample. Navigation blur closes overlays. Dismissible
samples do not simulate in-flight wallet operations.

Tests cover action/dismiss order, repeated taps, outside/Back dismissal, message-only
and destructive variants, dismissal locks, draft cancel/commit, blank names, both
appearances, scrolling, step back/finish/reset, six dialog variants and blur cleanup.
Gorhom/native hosts are mocked. Device checks remain for drag, backdrop, Android
Back, keyboard sizing, scrolling, accessibility focus, safe areas and large text.
