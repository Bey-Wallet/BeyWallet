# App theme

`src/shared/theme/appearance.ts` defines semantic colors, typography, spacing, dimensions and
roundness. The existing `dark` and `light` themes apply them through the current provider.
Brand accents are white in dark mode and black in light mode, with the opposite foreground
available as `$onAccent`. Existing blue aliases resolve to neutral colors for compatibility.

Color roles include page and alternate backgrounds, content and tinted surfaces, three text
and icon levels, input backgrounds and error states, separators, three overlay strengths,
active/inactive tab icons, and enabled/highlighted/disabled button states. Success, warning,
and error retain their semantic colors. Neutral cards use the base surface; branded secondary
buttons use their own fill, avoiding gray backgrounds on large payment cards.

Special Gothic 400/500/600 remains active. The 700 asset stays unregistered. Common text sizes
use 10/12/14/16 for captions and body text, 20/24/32 for headings, 32 for result/detail amounts,
and 40 for balances and larger confirmation amounts. Result/detail conversion text uses 14.
Body text uses 400, labels use 500, and headings use 600. Explicit larger amount-input and
screen-specific type sizes remain supported. Button labels use the named label styles.

Corner radii use 4/8/12/16/20 points for small details, controls, cards, and sheets. Grouped
cards retain 16-point outer corners and clipped rows; circular controls remain circular.
Lists default to compact 14-point text with a 48-point minimum row height and 16-point
horizontal padding. Settings descriptions use 12-point text. Mint details and previews share
the same base surfaces, clipped corners and full-width 2-point separators as Settings.
Explicit regular-size tables can use 16-point text and a 56-point minimum. The tab bar is 64 points high,
plus the device's safe area. Existing button sizes and their minimum 48-point touch targets
are preserved. Settings separators remain full width and 2 points thick.

Special Gothic remains the bundled family. Existing balance and amount size choices are
preserved, including the smaller result/detail amounts. Navigation behavior, wallet operations
and the current spinner implementation remain unchanged. No additional font dependency,
component gallery or alternate root provider is required.

Large payment-entry cards use the base surface (`$gray2`), with raised gray reserved for
smaller inset controls. Error surfaces retain their semantic red treatment.

The navigation root and native screen surfaces use the canvas color, including behind Android's
system navigation buttons. `plugins/withNavigationBarContrast.js` disables the native contrast
scrim during prebuild; the installed navigation-bar plugin does not support the `enforceContrast`
option. Native changes require an Android rebuild. Review both light and dark appearances on a
device with three-button navigation and gesture navigation.
