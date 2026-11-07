# BUI icons, avatars and badges

Open Settings → Advanced → BUI → Icons & avatars or Badges. Both screens use the
shared light/dark selection and BUI palette, including the blue primary.
Catalog groups4 and5 are Preview, not approved for production rollout.

Reusable components live in `src/shared/ui/BUI/`:

- `BUIIcon`, `BUIIconButton`, `BUICircleIcon`: existing Lucide icons, semantic BUI
  tints, defaults16/28, stroke1.8,36-point circle/20-point glyph and32-point action
  circle/16-point glyph. Interactive targets remain at least48; disabled actions
  block presses. Back and chevron cues mirror for RTL.
- `BUIAvatar`: default36, circular center crop, caller-sized44/56 examples and a
  caller-rounded shape. Loading uses contentTint; an error with initials uses a
  1-point outline and10-point text, while empty failure retains the neutral fill.
  Image reveal uses240 ms and respects reduced motion. Source changes remount the
  image state; old asynchronous dimension responses are ignored.
- `BUIBadgedAvatar`: circle/square/outside-corner strategies, all four directions,
  measured badge dimensions and physical-pixel offset truncation. The cutout radius
  is half the badge's larger dimension plus2. SVG masks remove the actual image
  and placeholder behind the badge, preserving transparency on arbitrary surfaces.
- `BUIAvatarStack`:4-point overlap and2-point cutouts, with selectable stacking order.
- `BUILabel`: H20/R4, horizontal5/top4/bottom5, uppercase10 Medium/tracking0.1.
  Neutral uses contentTint; other tones use a16% tint of BUI's corresponding color.
  An11-point Inter line box fits the fixed-height sample.
- `BUICounter`: body14/line14 or compact10/SemiBold, bottom1, width based on text
  width plus one quarter of measured height with a circular minimum. Null/empty
  values are omitted; zero remains visible;99+ is explicit text rather than an
  automatic cap. Error fill uses BUI error rather than hardcoded pure red.
- `BUIBadgeButton`: full pill, contentTint, padding16 × 8, gap6, Label2 14 Medium,
  optional leading/trailing content and an optional press callback.
- `BUIVerificationBadge`: Lucide BadgeCheck at16 or12, using BUI primary.
- `BUISpamBadge`: warning fill, R8, padding8 × 4 and uppercase Label2 14 Medium.
- `BUIInlineLabel`: reserves trailing badge width while ellipsizing the main label.

Geometry follows the Android design reference pinned at `70abb50`, particularly
`DefaultCellComonentes.kt`, `MoonAsyncImage.kt`, `MoonLabel.kt`, `MoonBadge.kt`,
`MoonBadgeButton.kt` and `MoonBadgedLayout.kt`. Account images44/badge20 and shelf
images56 match the inspected call sites.

The user selected **Lucide instead of copied icon vectors**. No copied icon data
or source-icon license file is retained. Existing Bitcoin artwork is a local sample;
real mint/person artwork is accepted without recoloring. No external image requests
are needed by the playground. BUI colors intentionally replace source accent tints.

Inter replaces source fonts, and the inline label uses a React Native row rather
than an Android ReplacementSpan. Glyphs, font baselines, natural line heights and
inline-span behavior therefore differ even where component dimensions match.
Tests cover route rendering, both themes, overlay placement/density, mask IDs,
image response races/fallbacks and empty/zero counts. Device review remains for
image loading/failure, crossfade, SVG transparency, text metrics, larger fonts,
screen-reader grouping and RTL appearance.
