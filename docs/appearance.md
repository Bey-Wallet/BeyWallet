# App theme

Screen headers use centered `ModalHeaderTitle` text and the canvas background, without a
bottom shadow or an additional native back button. `useScreenHeaderOptions` shares these
defaults between Settings, modals and payment stages. Header actions use `HeaderIconButton`:
neutral Ghost circular controls with 22-point icons and at least 48-point touch areas.
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
use 10/12/14/16 for captions and body text and 20/24/32 for headings. Pending amounts use 32-point
primary text and 14-point secondary conversion text. Confirmation screens, final results, and
transaction details use 40-point primary amounts and 16-point secondary conversions.
Body text uses 400, labels use 500, and buttons, headings and amounts use 600. Explicit larger
amount-input and screen-specific amount-entry sizes remain supported. All button styles use
SemiBold (600) labels.

Corner radii use 4/8/12/16/20 points for small details, controls, cards, and sheets. Every rounded
button size uses the same **16-point radius** (`$6`). `AppInput`/`AppTextArea` and mode-selector
triggers default to 12 points (`$5`).
Cards and grouped lists use **16 points** (`$6`) with clipped child rows; sheets use **20 points**.
Circular icon controls, avatars, status badges, switch tracks, and the approved toast pill retain
their intentional shapes. Decorative small details may still use 4 or 8 points. Glow cards and
conversation cards use the shared card radius. Explicit caller shapes remain available for special
input contexts; their sizing cannot silently change the default radius.
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
or alternate root provider is required.

Home's smaller balance is a neutral pill with a minimum 48-point touch area. Tapping
it swaps the primary sats/fiat presentation using the existing saved display preference.
Switching is disabled while balances are hidden; when fiat currency is None the pill
is absent. Settings retains the fiat-currency picker and removes the redundant Display
unit toggle. The Home-only visibility guard does not change other currency controls.

Home keeps the balance, Scan/Receive/Send actions, and connected mints together in that order.
Home's mints use an open list on the page background, with 44-point artwork and compact
14-point row text. Keep the current semantic font colors and omit the grouped fill and separators.
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
