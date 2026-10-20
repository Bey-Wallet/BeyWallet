# Mint QR overlay — saved design reference

Saved on 2026-10-20 for a future implementation.

The user reverted the mint-profile redesign but explicitly liked its QR overlay.
Preserve this overlay treatment as a design reference. The rest of that redesign
was rejected; this note does not request restoring it or implementing anything now.

## Appearance and behavior

- Open from **Show QR** on the mint profile.
- Present a full-screen React Native `Modal` above the current screen, without
  navigating away. The modal uses `transparent` with a full-screen, opaque,
  theme-aware `$background` container and `animationType="none"`.
- Center the content vertically and horizontally with comfortable spacing
  (`p="$4"`, `gap="$4"`).
- Show the heading **Mint URL** at 20 points, weight 600.
- Render a 240-point black QR code on white, inside a white panel with `p="$4"`
  and `rounded="$6"`. Keep this white surround in dark mode for scanning contrast.
- Encode the exact mint URL, including its path and case.
- Display the full URL below the QR as centered, selectable text.
- Provide a **Close QR** button beneath the URL, using `AppButton` with
  `variant="default"`, `emphasis="secondary"`, and `size="medium"`.
- Android back / `onRequestClose` dismisses the overlay and returns to the same
  underlying screen. Mark the overlay container `accessibilityViewIsModal`.

When implemented later, verify scanning, dismissal, long URLs, accessibility,
safe-area spacing, and both light and dark themes on a device.
