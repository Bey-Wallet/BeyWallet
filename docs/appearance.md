# App theme

Screen headers use centered `ModalHeaderTitle` text and the canvas background, without a
bottom shadow or an additional native back button. `useScreenHeaderOptions` shares these
defaults between Settings, modals and payment stages. Header actions use `HeaderIconButton`:
neutral Ghost circular controls with 22-point icons and at least 48-point touch areas.
Shared bottom sheets use `$background` with a 1-point `$borderColor` top border.
Pending payment screens use short header titles (at most two words) and a right-side header icon
for receipt image sharing. Keep existing management actions alongside it and the title centered.
Both navigation controls stay on the left: `ArrowLeft` returns to a previous screen or editable
step; `X` dismisses a standalone modal, scanner, root sheet, or finished flow. Nested sheet steps
use a back arrow. Other header actions stay on the right. Screen-specific callbacks, loading
and disabled states remain with each screen. Home and tab navigation keep their own styling.

Utility icon buttons, including Ghost buttons, use proportional 14/16/18/20/24-point glyphs
from xxsmall through large. An explicit `iconSize` overrides the glyph size without shrinking
the touch target. Home action cards, tab icons, and status artwork retain their own sizing.

`src/shared/theme/appearance.ts` defines semantic colors, typography, spacing, dimensions and
roundness. The existing `dark` and `light` themes apply them through the current provider.
Brand accents are white in dark mode and black in light mode, with the opposite foreground
available as `$onAccent`. Existing blue aliases resolve to neutral colors for compatibility.

Home follows the supplied Tangem reference for composition while keeping Bey's theme and type
sizes. Page edges are 16 points, the centered balance has a 160-point minimum height, equal
24-point vertical padding and matching 16-point gaps before the balance and actions. Its
secondary currency remains a compact neutral pill button for switching sats and fiat: 36 points
visually, 8-point horizontal padding and an expanded 48-point touch target. The full main balance,
including decimals, uses `$color` at full opacity. Scan, Transfer, Receive and Send fill the row as four equal
columns. Each circle occupies 80% of its column with a 48-point minimum diameter and its label
outside. There are 8 points between circle and label, 8 points between actions and a
32-point gap before the mint
panel. Connected mints share one `$buttonDefaultSecondary` panel with 16-point corners and
horizontal padding, circular 40-point artwork and 56-point minimum rows. Names and amounts use
14-point medium text, and hostnames use 11-point muted text. All actions retain at
least 48-point touch targets; enlarged system text can grow the balance and list naturally.
The visual reference is [Tangem's Android UI source](https://github.com/tangem/tangem-app-android/tree/master/core/ui/src/main/java/com/tangem/core/ui).

Currency prefixes have a narrow, non-breaking gap before the amount across fiat formatting, Bitcoin amounts and
amount entry (for example `$ 1,234.50`, `₹ 1,234.50` and `₿ 12,500`). Existing suffix placement,
localized decimal/group separators, signs and lower display limits remain intact.

The Point of sale flow is an explicit visual exception. Its local `light_pos` theme uses lime
(`#D4FF5A`) canvas backgrounds and black (`#000000`) typography in both app appearances.
Primary controls use black fills with lime text; secondary controls use darker lime fills.
QR surfaces stay white, with outlined groups and pill-shaped sale actions.
The theme wraps only `MerchantReceiveScreen`, so its mint and receipt sheets inherit the POS
palette while other wallet routes keep their normal theme. Amount entry and Lightning checkout
use an explicit `appearance="pos"` opt-in; other callers keep their existing layout and styles.
POS uses an inline close header and dark system status-bar icons against the lime canvas.
`AppBottomSheetThemeProvider` opts this flow's sheets into the same theme inside Gorhom's portal
container, where local screen context would otherwise be lost. Ordinary sheets keep their
existing container. QR codes retain black-on-white contrast.
After changing registered Tamagui themes during development, fully reload the app: Fast Refresh
can retain Tamagui's cached theme table from before the new theme was registered.

Light mode uses pure white page, navigation and sheet backgrounds. Cards and grouped lists
use a very light neutral gray (`#F7F7F8`), with slightly stronger fills for inset controls and
input fields. Muted text uses a darker neutral gray for readability on white. Hover, pressed
and disabled fills stay neutral, and separators remain subtle. Dark-mode colors are unchanged.

Color roles include page and alternate backgrounds, content and tinted surfaces, three text
and icon levels, input backgrounds and error states, separators, three overlay strengths,
active/inactive tab icons, and enabled/highlighted/disabled button states. Success, warning,
and error retain their semantic colors. Neutral cards and secondary buttons use the approved
neutral surface palette. There is one neutral button family; the duplicate Branded family is removed.

`AppButton` uses `variant="default" | "critical" | "warning"` for intent, and
`emphasis="primary" | "secondary" | "ghost" | "text"` for presentation. Primary is filled;
Secondary has a softer fill; Ghost is transparent with a touch highlight; Text stays transparent
in idle, hover, and pressed states without an underline. `AppTextButton` is a convenience wrapper
around that same Text implementation and accepts a custom foreground color. Sizes, icon placement,
loading, disabled state, and native link semantics remain supported. Switch variants retain their API.

Inter Text and Inter Display 400/500/600 are active, with tabular numbers, normal zero,
open digits (`ss01`) and disambiguation without slashed zero (`ss04`) enabled by default. Common text sizes
use the committed baseline reduced by 10%, with font sizes and line heights rounded to whole
points using `Math.round(original * 0.9)`. Captions are 9 points; body and labels use 11/13/14;
headings use 18/22/29; amount summaries use 29/25. Home balances and prominent payment amounts
use 40 points. Standard payment amounts use 29-point primary text and 13-point secondary conversions;
prominent amounts use 40-point primary text and 14-point secondary conversions.
Explicit screen text, keypads, POS, responsive amount entry and receipt-image text follow the same
reduction. Inter families, tracking, font weights, icons, padding, control heights and system
accessibility scaling retain Bey's conventions. This is one reduction from the committed baseline,
not repeated scaling. See the [current typography inventory](typography-10-percent.md).
Body text uses 400, labels use 500, and buttons, headings and amounts use 600. Explicit larger
amount-input and screen-specific amount-entry sizes remain supported. All button styles use
SemiBold (600) labels.

Corner radii use 4/8/12/16/20 points for small details, controls, cards, and sheets. Shared labeled
buttons use a **full pill radius** (`appRadii.pill`) at every size. Icon controls remain circular.
`AppInput`/`AppTextArea` and mode-selector
triggers default to 12 points (`$5`).
Cards and grouped lists use **16 points** (`$6`) with clipped child rows; sheets use **20 points**.
Circular icon controls, avatars, status badges, switch tracks, and the approved toast pill retain
their intentional shapes. Decorative small details may still use 4 or 8 points. Glow cards and
conversation cards use the shared card radius. Explicit caller shapes remain available for special
input contexts; their sizing cannot silently change the default radius.

Settings → Advanced → BUI provides component previews in the native development client only;
see [the BUI catalog](new-ui.md). Its preview themes remain separate from production appearances.
`ListTable` supports `separators={false}`; existing lists keep their default full-width dividers.
Lists default to compact 14-point primary text with a 48-point minimum row height and 16-point
horizontal padding. Settings descriptions use 13-point text. Mint details and previews share
the same base surfaces, clipped corners and full-width 2-point separators as Settings.
Mint list names use `label1`, with `body2` hostnames; section labels use `label2`. Mint previews use
`title3` names; mint details use `amountSmall` balances, `label2` conversions and `label3` status
badges. These top sections use explicit shared roles rather than inherited or separate hero sizes.
Explicit regular-size tables use 14-point text and a 56-point minimum. The tab bar is 64
points high, with 24-point icons and the standard top padding, plus the device's bottom safe area.
Each tab retains a minimum 48-point touch target. Existing button sizes and their touch targets
are preserved. Settings separators remain full width and 2 points thick.

Inter Text is used for UI copy; Inter Display is used for large text, balances and primary amounts.
Home balances use the 40-point display role; editable amounts use responsive 40/29/25/22/18-point
steps, including POS. See the [complete typography screen audit](typography-10-percent.md) for
every route, feature component, shared surface and the remaining device checks.
Payment amounts use `PaymentAmount` with `size="standard"` or `size="prominent"`;
`compact` controls spacing only. Primary amounts use `$color` and secondary amounts use `$gray10`.
Navigation behavior, wallet operations
and the current spinner implementation remain unchanged. No additional font dependency,
or alternate root provider is required.

Home's smaller balance is a neutral pill with a minimum 48-point touch area. Tapping
it swaps the primary sats/fiat presentation using the existing saved display preference.
Switching is disabled while balances are hidden; when fiat currency is None the pill
is absent. Settings retains the fiat-currency picker and removes the redundant Display
unit toggle. The Home-only visibility guard does not change other currency controls.

Home keeps the balance, Scan/Transfer/Receive/Send actions, and connected mints together in that order.
Home's mints use a grouped neutral panel with 40-point artwork, compact 14-point row text
and no separators. A small green circle with a check follows the active mint's name. Visible zero
balances use `$gray10`; hidden balances retain a uniform color. The header mint selector
uses a white pill with black text and chevron in dark mode, and black with white text
and chevron in light mode, with a subtle theme border
and a clipped circular 32-point mint icon. Its semantic offline treatment is preserved.
Long mint names truncate while the active check and amount remain visible. Home header
side controls occupy matching 64-point slots with 48-point touch targets. Tapping or holding
the main balance toggles privacy with a light haptic. Refresh feedback shares the status area
above the balance: successful updates briefly show `Updated just now`, then fade away
(without animation when reduced motion is enabled). Offline and restore status take priority.
Recommendations appear only when no mint is connected, with an explicit suggested-mints label.
Recovery progress and incoming payments follow the mints list. Home does not show backup,
username, or supporter prompt cards; their dedicated destinations remain available.
Satoshi amounts default to the Bitcoin symbol (`₿`) rather than the `sat` suffix. An explicitly
saved symbol preference is respected; this changes presentation only, not amount units.

The fiat picker shows all 25 current choices plus None without a More currencies step.
VND, PHP, IDR and ARS are no longer offered. Their metadata remains available for saved
preferences and imported backups; NGN and THB remain selectable. PLN and CZK use their
localized trailing `zł` and `Kč` symbols.

Existing payment Status rows go first in their detail lists, before Mint, Date, fees, or token
details. Completed success/failure screens retain the status above the amount without an extra
Status row. Pending status values use `$orange10`; specific states such as Unclaimed and
Unresolved retain their meaning. Detail rows stay compact and centered,
with full-width 2-point separators and clipped group corners.

Payment details and receipts use `formatPaymentDateTime` in the device-local timezone:
`Oct 24, 2026 8:33 PM` for a 12-hour device, or `Oct 24, 2026 20:33` for a 24-hour device.
Use abbreviated English months and no seconds. Follow the device clock preference: uppercase
AM/PM without a leading hour zero for 12-hour clocks, and two-digit hours (`00`–`23`) with no
AM/PM for 24-hour clocks. History rows use short relative times (`just now`, `5m`, `2h`, `1d`), with a
short date for items at least a week old. Date-only History headings and expiry countdowns
retain their purpose; chat timestamps and unrelated Settings dates are unchanged.

Large payment-entry cards use the base surface (`$gray2`), with raised gray reserved for
smaller inset controls. Error surfaces retain their semantic red treatment.

Generated Blockies avatars use a deterministic, versioned hash stream of the full seed. The v2
generator replaces the repeating 32-bit pattern, so existing fallback avatars change appearance
once; identities and profile pictures are unchanged. Foreground and accent hues span the color
wheel, with pale backgrounds visible through empty cells. Grids mirror horizontally for both odd
and even sizes without overlapping cells. Each color override works independently, and the same
seed retains its palette across grid sizes. This generator is for artwork only, never wallet keys.
Review fallback avatars at header, People and contact-sheet sizes on devices in both themes.

The navigation root and native screen surfaces use the canvas color, including behind Android's
system navigation buttons. `plugins/withNavigationBarContrast.js` disables the native contrast
scrim during prebuild; the installed navigation-bar plugin does not support the `enforceContrast`
option. Native changes require an Android rebuild. Review both light and dark appearances on a
device with three-button navigation and gesture navigation.
