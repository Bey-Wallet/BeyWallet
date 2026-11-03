# Surface consistency rules

Recorded direction: **one surface, one rhythm**, using Bey's existing foundation.
The temporary playground is removed. These rules guide future screen review/migration;
recording them does not mean production screens have already been restyled.
See [all screen targets](design-system-screens.md) and the [foundation](design-system.md).

## Surface and color

- Page: `$background`. Ordinary neutral cards, grouped lists, action groups, fields and
  secondary buttons: `$buttonDefaultSecondary`.
- Interactive fills use the existing secondary hover/pressed tokens and row feedback.
  Focus, disabled, error and loading states remain visible and accessible.
- Establish hierarchy through placement, spacing and typography. Avoid extra gray layers,
  decorative borders and shadows around every child. Group only related content.
- Primary text: `$color`. Descriptions/secondary values: `$gray10`. Supporting neutral icons:
  `$iconSecondary`/`$gray10`. Success/error/warning and unread indicators keep their meaning.

## Type, geometry and rhythm

- Use AppText with existing Inter Text UI and Inter Display amount/large-text roles. Keep the
  current Home balance size, weight, letter spacing and primary color.
- Compact lists: 14-point primary labels, 13-point descriptions; section labels may use 600. Keep
  system text scaling and wrapping, with minimum 48-point touch targets.
- Groups/rounded buttons: 16-point corners; fields: 12; sheets: 20. Clip child rows at the group
  corners. Preserve intentional circles and pills.
- Separators: full width, 2 points, existing page-background treatment.
- Page edges 16; within-item spacing 8; related elements 12; groups 24; major sections 32.
  Read these values from `~/shared/theme`, rather than copying literals into screens.
- Use the existing meaningful icon family. Lists use aligned 20–22-point glyphs; headers use 22. Transfer uses ArrowRightLeft.

## Actions and navigation

- Use AppButton: brand-filled default primary for the main action; neutral secondary for
  supporting actions; ghost/text for lower emphasis. Retain critical/warning intent colors.
- Preserve pressed, disabled/loading, accessible names, reduced motion and Bey's spinner.
  Smaller visuals retain their existing expanded touch areas.
- Settings/category lists navigate; editors and switches belong at dedicated destinations.
  Informational status rows have no press handler or chevron.
- Keep back/close on the left: ArrowLeft returns to a previous screen/step; X dismisses a
  standalone modal, scanner, root sheet or finished flow. Keep centered Settings titles,
  hidden Settings tabs, and return-to-origin behavior.
- Retain AppBottomSheet for the existing Send/Receive, mint-selection and NFC presentations.

## Explicit exceptions and protected behavior

- **Home connected mints:** preserve ConnectedMintsCard.tsx and its approved open-list styling
  unless explicitly requested. Inventorying Home is not authorization to regroup those rows.
- **POS:** preserve the lime/black light_pos palette, sale-action pills and white QR surfaces.
  Apply structural rules within that theme instead of replacing it with neutral fills.
- **QR/scanner/camera:** preserve code contrast, white QR backgrounds where required, camera
  viewfinders/overlays, scanning affordances and readable controls.
- **Semantic states/artwork:** retain pending/unclaimed/unresolved distinctions, destructive
  confirmations, unread markers, status artwork, mint/person images, avatars and Blockies.
- **Sensitive/in-flight flows:** keep destination authentication, hide-on-blur/background,
  secure key/phrase presentation, navigation guards and loading semantics. Visual migration
  must not change seed/key/proof, recovery, payment, persistence or native-device behavior.
- **Exported receipts:** review image contrast and export geometry separately from live UI.

## Adoption

Review one complete screen or flow at a time. Prefer existing shared components, then remove
confirmed local duplication. The inventory is a review checklist, not evidence that every screen
currently violates a rule.

For each migration verify light/dark, large system text, keyboard/safe areas, touch feedback,
loading/empty/error/success states and back/dismiss behavior. Payment, NFC, biometrics and
notification changes also require appropriate device checks.
