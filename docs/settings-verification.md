# Settings refactor verification

## Implemented

- Settings is a nested stack with a centered header, back navigation, and no bottom
  tab bar. Main/category rows navigate to dedicated screens instead of mutating values.
- Profile, preferences, security/privacy, backup/recovery, wallet tools, Nostr,
  advanced tools, support, and About have explicit destinations.
- Neutral cards use `$buttonDefaultSecondary`, muted text uses `$gray10`, and
  group/card corners use `$6`. Group dividers span the full width at 2 points.
- Authentication gates sensitive screens. Recovery material and secret keys are
  hidden on background/blur, and late authentication results are discarded.
- Existing wallet services, backup format, receiving policy, and proof validation
  remain in use. Wallet operations block removal of their screen while running.
- Settings-specific sheets were removed. Existing payment/mint feature screens
  and their operation controls remain available through their existing routes.
- About links to the existing combined Terms of Service & Privacy Policy page.

## Automated validation

Run the relevant checks from the repository root:

```sh
yarn typecheck
yarn check:structure
yarn check:buttons
yarn test:ci --runInBand --runTestsByPath tests/unit/settings-navigation.test.tsx tests/unit/settings-protected-value.test.tsx tests/unit/settings-backup-actions.test.tsx tests/unit/get-change-screen.test.tsx tests/unit/app-switch.test.tsx tests/unit/change-backup.test.ts tests/unit/nostr-auto-claim-policy.test.ts tests/unit/nostr-receipt-service.test.ts
```

These cover the header export regression, tab return destinations, switch state,
authentication rejection and backgrounding, backup confirmation/cancellation,
restore ordering, duplicate action taps, offline change review/cleanup, and existing
backup/receiving behavior. The Android development bundle was compiled through Metro.

## Device review still required

Use a disposable test wallet for operations that spend, restore, or delete wallet data.

- Open Settings from Home, History, and People. Check that the tab bar disappears;
  the root back button and Android back return to the correct tab. Open nested
  screens and a direct Settings link; confirm back navigation and centered titles.
- Review the main list, each category, and About in light/dark themes. Check `$6`
  corners, full-width 2-point dividers, Home-matching backgrounds, and `$gray10` text.
- Check small screens, large text, screen-reader labels, reduced motion, keyboard
  focus where supported, and retained list scroll positions.
- Change theme, units, currency, symbol, balance visibility, and notifications.
  Return to the category and restart the app to confirm current values/persistence.
- Approve and cancel biometric app-lock changes; test actual locking/unlocking.
- Reveal recovery phrase/private key, then background or leave the screen. Confirm
  content is hidden and authentication is required again. Do not capture secrets
  in screenshots or include them in support requests.
- Export a backup, cancel the picker/share UI, and restore a known backup in a test
  wallet. Verify operation progress, successful restore, and requested restart.
- Test offline change review, mint switching, fee changes, retry, and leaving before
  execution. Confirm navigation is blocked during submission and released afterward.
- Verify mint details/add/discovery routes, optimization, proof inspection, offline
  verification, blocked people, receiving policy, relay status, and Nostr diagnostics.
- Check profile/username and existing non-settings entry points, including backup
  warnings and onboarding. Follow website, support, documentation, and legal links.
- Test wallet deletion only after exporting a test wallet; cancel authentication
  and cancel the review before performing a deliberate confirmed deletion.
