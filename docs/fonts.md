# App fonts

Body text and headings use the approved, modified Funnel Display family, named **Bey Funnel
Display** internally to distinguish it from the upstream font:

| Weight       | Runtime name               | Asset                           |
| ------------ | -------------------------- | ------------------------------- |
| Regular 400  | `BeyFunnelDisplayRegular`  | `BeyFunnelDisplay-Regular.ttf`  |
| Medium 500   | `BeyFunnelDisplayMedium`   | `BeyFunnelDisplay-Medium.ttf`   |
| SemiBold 600 | `BeyFunnelDisplaySemiBold` | `BeyFunnelDisplay-SemiBold.ttf` |

`BeyFunnelDisplay-Bold.ttf` (700) is retained as an inactive asset. It is not registered in Expo
runtime loading, native embedding, or Tamagui face mappings. Requests for 700 and `bold` continue
to render using SemiBold 600.

## Integration

The `$body` and `$heading` families share these three static faces. Requests below 400 resolve to
Regular, and requests above 600 resolve to SemiBold. Weight tokens `$4`, `$5`, and `$6` select
400/500/600. Existing text sizes, line heights, letter spacing, tabular numeral requests, and
accessibility scaling are preserved. Dedicated `Mono` text remains unchanged.

Runtime loading is in `src/shared/layout/RootLayout.tsx`; native embedding is configured in
`app.json`. Navigation fonts and header titles use the same family. Native bottom-sheet inputs
and the public-key input explicitly select Regular. Plain Tamagui Text, named text components,
inputs, and toasts use the existing `$body` defaults. OS-owned permission dialogs, share sheets,
and keyboards retain the platform font.

The user confirmed the fonts work in the existing Expo dev client through runtime asset loading.
A reload can load these new font files without rebuilding a compatible dev client. A future native
build will also include the updated embedded-font configuration from `app.json`.

## Approved glyphs and provenance

The user supplied Funnel Display by NORD ID and Kristian Möller in
`C:\Users\Zaheer\Downloads\Funnel_Display`. The final production assets are the approved design;
temporary HTML previews, generators, screenshots, and comparison fonts have been removed.

The modified fonts add Bitcoin `₿` U+20BF, rupee `₹` U+20B9, ruble `₽` U+20BD, won `₩` U+20A9,
lira `₺` U+20BA, and full-width yen `￥` U+FFE5. Original dollar, euro, pound and yen glyphs remain
unchanged. Coverage checks include the symbols and formatted values for Bey's 21 fiat currencies.
Native Intl implementations can vary, so device checks remain necessary.

Rupee revision 5 adapts the matching Special Gothic upper outline to Funnel's cap height and keeps
the approved straight diagonal leg. Both source families use SIL OFL 1.1; their copyright notices
and the license are consolidated in `src/assets/fonts/BeyFunnelDisplay-OFL.txt`.
The derivative also embeds attribution to both families.
These licenses remain separate from the application's Apache 2.0 license.

Special Gothic font binaries have been removed. The adapted rupee's original source is
[Special Gothic revision 17774cf97eec75a115aebc7ed66a57ce67b88177](https://github.com/AlistairMcCready/Special-Gothic/tree/17774cf97eec75a115aebc7ed66a57ce67b88177).

## Validation

The font asset regression tests check weights, currency coverage, and SHA-256 hashes of the
approved production files, without depending on temporary design files.
Typography and appearance tests check rendered family selection and the existing weight mappings.

Device acceptance checks:

- Review Home, payment entry/results, Settings, onboarding, messages, and navigation headers.
- Check bottom-sheet/native inputs, button labels, long text, both themes, and larger system text.
- Inspect `₿`, `₹`, `₽`, `₩`, `₺`, and both yen variants at row and balance sizes.
- Confirm Regular/Medium/SemiBold render distinctly, no text clips, and 700 remains mapped to 600.

The user confirmed the current Expo dev-client appearance. The full screen/accessibility matrix,
iOS-specific behavior, and a newly embedded native build have not been independently verified.
