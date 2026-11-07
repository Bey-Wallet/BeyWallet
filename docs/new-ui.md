# Bey Wallet BUI

BUI is the only component playground. Open Settings → Advanced → BUI in the
native development client. It is hidden and route-protected in release builds,
Expo Go and web. Each route also checks access before loading its screen.

## Retained catalog

| Section               | Previews                                                                                  |
| --------------------- | ----------------------------------------------------------------------------------------- |
| Foundations           | Theme & colors; Layout & spacing; Typography; Icons & avatars; Badges                     |
| Core components       | Buttons; Inputs & forms; Selection controls; Tabs, chips & selectors; Lists & rows; Cards |
| Navigation & overlays | Headers & navigation; Sheets & dialogs; Menus & tooltips                                  |

The catalog contains 14 groups. All other playground screens, helpers, reference
screens and their dedicated routes/tests/docs have been removed. Production
wallet, payment, recovery and device behavior is unchanged.

## Theme and components

Only light and dark appearances are available. Light uses a white page and
relative neutral card surfaces; dark uses a black page. Primary buttons use blue
with white text in both appearances. Light secondary button fill is softened;
tertiary buttons remain transparent with blue text. There are no accent presets.

Small buttons are36 high/radius18/text14; medium48/radius24/text16;
large56/radius16/text16. Interactive targets remain at least48 points.
Inter Text and Inter Display use the app's prepared static faces. Existing Lucide
icons supply the icon family. BUI's preview themes and measurements remain scoped
to BUI rather than migrating production screens.

Shared components live in src/shared/ui/BUI/. Screen implementations live in
src/features/settings/; their local catalog and form helpers are in
src/features/settings/bui/. Thin routes retain the existing URLs, including
new-ui, new-ui-colors and new-ui-buttons.

## Component notes

- [Icons, avatars and badges](bui-icons-avatars-badges.md)
- [Forms and selections](bui-forms-selections.md)
- [Tabs, chips and selectors](bui-tabs-chips-selectors.md)
- [Lists and rows](bui-lists-rows.md)
- [Cards](bui-cards.md)
- [Headers and navigation](bui-navigation.md)
- [Sheets and dialogs](bui-sheets-dialogs.md)
- [Menus and tooltips](bui-menus-tooltips.md)

The access policy is in src/shared/utils/developmentClient.ts. It requires
**DEV**, a native platform, a non-Expo-Go host and the native development menu.
The Settings stack protects every BUI route; the route factory additionally
guards direct loading. Preview state is memory-only.

Device review remains necessary for keyboard/sheet behavior, native popup
placement, font scaling, screen-reader focus and animation feel. Automated checks
do not establish pixel-identical native rendering.
