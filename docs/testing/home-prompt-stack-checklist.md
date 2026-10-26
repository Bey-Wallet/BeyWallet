# Home prompt stack

Home groups wallet backup, username claiming, and the supporter preview into one compact stack.
The cards use a 1 dp `$borderColor` outline on a `$buttonDefaultSecondary` surface, 14-point heading, 12-point
description, and top-aligned leading icon. One narrower backing card is visible with a 10 dp
offset and 95% resting scale. There is no section heading, counter, or automatic rotation.
Content uses 12 dp padding and a 12 dp icon/text gap, matching Home's action buttons, with
additional right-side space for the 48 dp dismiss target. Default, hover, and pressed fills use
the same `$buttonDefaultSecondary` palette as those buttons.

Swipe left/right to cycle with wraparound. X dismisses only the foreground card: backup keeps
its existing seven-day snooze; username and supporter keep their existing persistent dismissal.
Completed backup and claimed/loading username prompts are excluded. Restore progress and
pending Lightning payments remain separate, visible status surfaces.

The close button is anchored by a separate native absolute wrapper, inset 6 dp so its shared
48 dp touch target stays inside the card. The gesture root is non-collapsing and full-width;
the foreground stays in normal layout flow while backing layers are absolute. Text wraps and
the card grows with font scale. Reduced motion keeps the resting stack but switches cards
without swipe animation. Screen-reader next/previous actions remain available.

Automated checks cover eligibility, per-card dismissal, routes, wraparound, short/flick pans,
drag interaction guards, reduced motion, the supporter modal, and close-button placement.
A temporary React Native Web layout check confirmed non-empty foreground text and icon bounds;
its gesture/animation adapters were stubbed, so it does not verify native gesture performance.

Still verify on Android/iOS (no device was attached during local validation):

- At 320/360/400 dp widths and larger font sizes, confirm readable content, top-aligned icons,
  an inset muted X, a visible next-card edge, and no overlap with the following Home cards.
- Swipe both directions, reverse during a pan, cancel a short swipe, and scroll vertically.
- Rapidly swipe/tap/dismiss; only the foreground should react and no empty layer should remain.
- Dismiss each prompt independently, restart, and check its existing saved visibility policy.
- Tap backup and confirm destination authentication; open/close the username and supporter flows.
- Enable reduced motion and exercise screen-reader next/previous actions and dismissal.
