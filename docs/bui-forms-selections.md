# BUI inputs, forms and selection controls

Open Settings → Advanced → BUI → Inputs & forms or Selection controls.
Catalog groups7/8 are Preview. Components are under `src/shared/ui/BUI/`;
the feature screens and local validation helper stay under Settings.

## Inputs

`BUIInput` is a controlled, ref-forwarding field using BUI colors. It follows the
inspected `MoonTextFieldCell.kt` geometry: horizontal outer inset16, minimum64,
R20 (`UIKit.shapes.large`), border1.5 and padding16 × 12. Body1 is16/24.
The border overlays the surface rather than consuming content padding.
Expanded hint space is reserved even while collapsed; with a24-point label/text
line this can make the actual field70 points high. A focused/nonblank field
floats its label to75%, separated from the text by4, over150 ms with the matching
cubic easing. The label/text positions interpolate within the reserved layout.

Clear appears only for focused, nonblank, enabled/editable input without loading,
success or disableClear. Loading shows the existing16-point spinner and does not
itself disable editing, following the source. Success only suppresses Clear; it
adds no green border/checkmark. Error wins over focused border color and uses the
field-error fill. Helpers/error messages are an additional BUI form composition.

`BUITextArea` enables multiline with four visible lines by default; the native
input grows to the limit, then scrolls. `BUIInput` defaults to single-line input.
Suffixes are measured with the same text style, then placed at the measured text
end plus4 and clamped to the space before trailing content. The native input
yields width to suffix/trailing content. A secure value is masked when measured.

`BUISearchInput` follows the48-point/R20 search composition: border1.5, leading16
glyph with horizontal16 padding and edit padding2 × 6. Focus takes precedence over
search-error border color as in the source. Clear/Cancel remain separate targets.

`BUIPasswordInput` uses invented sample text and native secureTextEntry. Its reveal
state resets on field blur/background; the form preview unmounts it while unfocused.
It is a presentation component and invokes no wallet authentication or storage.
Read-only/disabled input blocks change callbacks as well as native editing.

The Validation tab demonstrates On blur/On submit/Live timing and Next focus flow.
Its rules are deliberately local: name3–40 trimmed characters, code BUI-1234,
note≤120 characters. They must not be reused as address/payment validation.

## Selection controls

- `BUISwitch`:50 × 30 track,26 thumb, vertical inset2, x positions2.5/21.5.
  BUI primary fills the checked track; the active thumb uses its contrasting
  foreground, intentionally adapting the source's always-white thumb for BUI.
  The inactive track uses tertiary button fill. Disabled opacity48% is a BUI
  composition extension. The source spring is recreated with React Native motion;
  reduced motion snaps the visual state.
- `BUICheckbox`:22 visual/R6/border2, outer padding3 and Lucide check16.
  Checked uses primary/foreground; unchecked border uses icon tertiary.
  Disabled visual opacity48% follows the source.
- `BUIRadio`: Material radio geometry,20 outer visual/stroke2/padding2 and a10-point
  drawn center dot. The12-point dot-size token is reduced by stroke during drawing.
  Disabled uses primary text at38% alpha. Checked radio presses report true rather
  than deselecting the group. The state changes are immediate, without native ripple.
- `BUISelectionRow`: one accessible control owns the label and visual; child visuals
  have no nested press target. Checkbox rows use padding16 × 12/gap8/Body1, matching
  the text-checkbox source. Other row types use the standard16 × 8 composition.
  Optional information actions have a separate48-point target.

Standalone interactive controls preserve at least48-point targets around smaller
visuals. A missing change callback renders a blocked, full-opacity read-only sample;
explicit disabled state also changes the visual. Playground state is not persisted.
The button playground's Full width toggle now uses `BUISwitch` too.

## Fidelity and verification

Measurements and main field/checkbox/switch state rules come from the pinned
Android reference70abb50: `MoonTextFieldCell.kt`, `MoonEditText.kt`,
`MoonSearchCell.kt`, `MoonSwitch.kt`, `MoonCheckbox.kt`, `MoonTextCheckboxCell.kt`.
Material radio measurements were checked against the official
[AndroidX implementation](https://raw.githubusercontent.com/androidx/androidx/androidx-main/compose/material3/material3/src/commonMain/kotlin/androidx/compose/material3/RadioButton.kt).

This is not a pixel-identical native port: Inter and Lucide are intentional
substitutions. Text baselines/intrinsic measurements, native secure entry,
keyboard/caret behavior, suffix alignment and spring rendering remain React Native
implementations. Focused tests verify clear gating, editing guards, password
visibility reset, selection callbacks, disabled/read-only controls, route sections,
both themes and demo validation. Device checks remain for exact appearance, larger
text, keyboard Next/Cancel, clear/reveal focus retention, multiline/suffix scrolling,
screen readers and reduced-motion feel.
