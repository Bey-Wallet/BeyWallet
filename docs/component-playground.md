# Component playground

Open **Settings → Advanced → Component playground** in the updated app. This page uses the actual
production components with sample content, so future edits to those components appear here too.
The playground reflects the consolidated button styles and shared corner-radius roles.

Under **List tables → Table style**, choose **Filled** or **Outlined**. Outlined tables have a
transparent background and matching soft-contrast 2-point neutral outer borders and row dividers, retaining
the same `$6` corners and compact spacing. Compare both styles in light and dark preview themes;
copy, actions, disabled controls, and long values use the same shared rows. Filled remains the base
component default. Transaction receipt sheets and result receipts use the outlined style; both
styles remain available in the playground. See [transaction receipts](transaction-receipts.md).

Payment summaries and transaction details use the compact `ListTable` shown here: 14-point text,
48-point minimum row height, `$6` grouped corners, and full-width separators. Mint/balance selectors,
payment-request recipients, and on-chain fee choices also use these rows. The playground includes
sample mint/balance and fee-choice controls; their actions only update the local preview.

Dividers belong to each shared row, so fragments and helper components cannot hide intermediate
separators. The table clips the first divider at its top edge. Note, transaction-hash, and expanded
mint-capability helpers do not add a second set of dividers. On a device, open a transaction with
five or more rows and confirm one 2-point full-width divider between each adjacent visible row,
including notes and transaction hashes, with no divider above the first or below the last row.

Payment consistency validation: 3 focused suites / 40 tests passed, including separate mint/Max
actions, disabled selectors, empty-balance Max, selected choices, pending receipts, and on-chain
details. Device checks: open the same payment from its result screen and History, compare compact
rows, then try long mint names, fee selection, Max, large text, and screen-reader selection state.
Confirm the keypad and footer still fit on a small screen. Physical-device layout remains unverified.

- **Buttons:** one neutral family and two semantic intents (`default`, `critical`, `warning`), with
  four styles (`primary`, `secondary`, `ghost`, `text`). The duplicate Branded family is removed.
  Select any of the five sizes and test
  normal, disabled, loading, and loading-plus-disabled states. Switch leading/trailing/both/no icons,
  full width, and long labels. The same variant/emphasis matrix is available for icon buttons, with
  rounded/circular shapes. Rounded buttons keep the same 16-point corners (`$6`) at every size; circular
  buttons remain circular. Header controls and custom-color background-free text buttons are included.
- **List tables:** compare compact and standard density, read-only values, zero values, copy controls,
  action/disabled rows, semantic values, custom switch content, trailing icons, and long wrapping text.
  Settings groups include descriptions, selection checkmarks, navigation/external cues, and disabled
  or destructive samples. Copy rows place only clearly labeled sample text on the clipboard.
- **Cards:** try the real Home prompt stack, sample conversation messages/payment cards in their
  status states, a sample Pay action (normal/disabled), and the existing onboarding glow card. Swiping
  cycles prompts; X dismisses a sample prompt. Reset restores the sample prompts. Wallet balance and
  connected-mint widgets are not mounted with live wallet data in this playground.

The footer counts sample actions and names the last one. Payment, deletion, navigation, and external
link samples only update that local counter; they do not execute those operations. Prompt dismissal
only affects the sample prompts. All playground choices reset when the screen is left.

**Preview theme → App / Light / Dark** changes this page's preview without saving a global preference.
The navigation header and global toast layer retain the real app theme. The glow card retains its
existing dark onboarding surface. Check system text scaling, portrait/landscape, keyboard focus,
VoiceOver/TalkBack, and Reduce Motion using your device settings. Disabled/loading samples should
not increment the action counter. Text actions have no loading variant; they preview normal/disabled.

Implementation lives in `src/features/settings/ComponentPlaygroundScreen.tsx`. The Expo route is a
thin export, and the Settings catalog/route manifest provide navigation. The shared components now
use consistent roles: buttons/cards/groups 16 points, inputs 12 points, sheets 20 points. Wallet execution
is unchanged. Native touch, layout, and gesture checks still require a device.

Initial playground validation: 6 focused component suites / 49 tests and 8 web control tests passed. Typecheck, button
checks, the 74-route structure check, scoped formatting, and whitespace checks passed. The tracked
interaction source index was refreshed for the new route and sample controls. These automated checks
do not verify the playground's physical-device layout or gestures.

After button consolidation, the relevant regression suite passed **169 suites / 1,340 tests**;
the two previously documented baseline harness failures (`header-navigation.test.tsx` and
`mint-url-navigation.test.tsx`) remain excluded. The separate web controls suite passed **8 tests**.
Button behavior, contrasting palettes, constant corner radius across sizes, actual input/group
radii in both themes, custom input corner overrides, and Ghost-versus-Text interaction are covered.

To review this change on your phone:

1. Under Buttons, confirm there is one neutral family, plus Critical and Warning intents. Try
   Primary, Secondary, Ghost, and Text. Ghost highlights when pressed; Text never adds a fill or underline.
2. Switch through all five sizes: rounded buttons must keep the same corner curvature. Select
   Circular icon buttons: those should stay circular. Repeat in light and dark preview themes.
3. Compare List tables and Cards: buttons, groups, and cards share 16-point corners; inputs use
   12-point corners. Prompt dismissal and sample card actions must still affect samples only.
4. Open an actual editable field, such as the relay URL in Settings. Check its 12-point corners,
   focus, keyboard, and editing. Special fields with explicit corner choices retain those choices.
5. Check loading/disabled samples, longer labels, larger device text, VoiceOver/TalkBack, and
   Reduce Motion. Confirm protected payment screens still keep their original guards and callbacks.

Shared code: `AppButton.tsx` owns the four styles; `AppTextButton.tsx` wraps its Text style;
`AppInput.tsx` owns default input/text-area corners. The unused old Home button playground was
removed. The active Component playground remains under Settings → Advanced.
