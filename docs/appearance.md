# App theme

Screen headers use centered `ModalHeaderTitle` text and the canvas background, without a
bottom shadow or an additional native back button. `useScreenHeaderOptions` shares these
defaults between Settings, modals and payment stages. Header actions use `HeaderIconButton`:
neutral tertiary circular controls with 22-point icons and at least 48-point touch areas.
Both navigation controls stay on the left: `ArrowLeft` returns to a previous screen or editable
step; `X` dismisses a standalone modal, scanner, root sheet, or finished flow. Nested sheet steps
use a back arrow. Other header actions stay on the right. Screen-specific callbacks, loading
and disabled states remain with each screen. Home and tab navigation keep their own styling.

Utility icon buttons, including tertiary buttons, use proportional 14/16/18/20/24-point glyphs
from xxsmall through large. An explicit `iconSize` overrides the glyph size without shrinking
the touch target. Home action cards, tab icons, and status artwork retain their own sizing.

`src/shared/theme/appearance.ts` defines semantic colors, typography, spacing, dimensions and
roundness. The existing `dark` and `light` themes apply them through the current provider.
Brand accents are white in dark mode and black in light mode, with the opposite foreground
available as `$onAccent`. Existing blue aliases resolve to neutral colors for compatibility.

Light mode uses pure white page, navigation and sheet backgrounds. Cards and grouped lists
use a very light neutral gray (`#F7F7F8`), with slightly stronger fills for inset controls and
input fields. Muted text uses a darker neutral gray for readability on white. Hover, pressed
and disabled fills stay neutral, and separators remain subtle. Dark-mode colors are unchanged.

Color roles include page and alternate backgrounds, content and tinted surfaces, three text
and icon levels, input backgrounds and error states, separators, three overlay strengths,
active/inactive tab icons, and enabled/highlighted/disabled button states. Success, warning,
and error retain their semantic colors. Neutral cards use the base surface; branded secondary
buttons use their own fill, avoiding gray backgrounds on large payment cards.

Inter Text and Inter Display 400/500/600 are active, with tabular numbers, slashed zero,
open digits (`ss01`) and disambiguation (`ss02`) enabled by default. Common text sizes
use 10/12/14/16 for captions and body text and 20/24/32 for headings. Pending amounts use 32-point
primary text and 14-point secondary conversion text. Confirmation screens, final results, and
transaction details use 40-point primary amounts and 16-point secondary conversions.
Body text uses 400, labels and buttons use 500, and headings and amounts use 600. Explicit larger amount-input and
screen-specific amount-entry sizes remain supported. Button labels use Medium (500).

Corner radii use 4/8/12/16/20 points for small details, controls, cards, and sheets. Grouped
cards retain 16-point outer corners and clipped rows; circular controls remain circular.
Lists default to compact 14-point text with a 48-point minimum row height and 16-point
horizontal padding. Settings descriptions use 12-point text. Mint details and previews share
the same base surfaces, clipped corners and full-width 2-point separators as Settings.
Explicit regular-size tables can use 16-point text and a 56-point minimum. The tab bar is 64 points high,
plus the device's safe area. Existing button sizes and their minimum 48-point touch targets
are preserved. Settings separators remain full width and 2 points thick.

Inter Text is used for UI copy; Inter Display is used for large text, balances and primary amounts.
Home balances and editable amount inputs retain their
existing sizes. Payment amounts use `PaymentAmount` with `size="standard"` or `size="prominent"`;
`compact` controls spacing only. Primary amounts use `$color` and secondary amounts use `$gray10`.
Navigation behavior, wallet operations
and the current spinner implementation remain unchanged. No additional font dependency,
component gallery or alternate root provider is required.

Home's smaller balance is a neutral pill with a minimum 48-point touch area. Tapping
it swaps the primary sats/fiat presentation using the existing saved display preference.
Switching is disabled while balances are hidden; when fiat currency is None the pill
is absent. Settings retains the fiat-currency picker and removes the redundant Display
unit toggle. The Home-only visibility guard does not change other currency controls.

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

The navigation root and native screen surfaces use the canvas color, including behind Android's
system navigation buttons. `plugins/withNavigationBarContrast.js` disables the native contrast
scrim during prebuild; the installed navigation-bar plugin does not support the `enforceContrast`
option. Native changes require an Android rebuild. Review both light and dark appearances on a
device with three-button navigation and gesture navigation.
