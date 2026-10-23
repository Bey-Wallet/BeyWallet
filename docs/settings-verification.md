# Settings refactor verification

## Implemented

- Settings is a nested stack with a centered header, back navigation, and no bottom
  tab bar. Toggle-only preferences (display unit, Bitcoin symbol, notifications,
  hide balance, and biometric app lock) use switches directly in category lists.
  Other rows navigate to dedicated screens. App lock still authenticates each change.
- Ordinary inline toggles respond immediately and serialize rapid changes while saving.
  The shared switch uses compact iOS-style proportions and respects reduced motion;
  onboarding and send confirmation use the same control. ListTable rows center their contents.
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
- Proof Manager was rebuilt as a minimal list with mint/state filters, export,
  refresh, and confirmed spent-only cleanup; the old detailed manager was removed.
- Relays support persisted add/remove and confirmed reset to defaults. Row status
  dots use actual pool connection state. Nostr health is a read-only overall row.
- The Settings profile badge appears only after authoritative NIP-05 verification;
  a missing registration exposes a direct Claim action.
- Updates use native download progress; Username uses a plain edit form.
- Mint backup has an automatic-publish switch, a manual Backup now action, and
  last-attempt/relay-acknowledged publication times. Automatic startup/resume and
  mint-list-change publishes are silent. The existing public Nostr mint-list format
  is preserved; recovery phrases and ecash are not published.
- Offline ecash confirmation offers Save & claim later. This saves an unclaimed
  history entry locally without trusting a mint or crediting the balance. Proof
  status checks resume online, and duplicate save/claim taps share one operation guard.
- Blocked people uses a searchable virtual list with checkable rows, select-all
  results, and one confirmed bulk-unblock action. Unblocking persists in one update
  and preserves the requirement to accept those contacts again.
- Recover funds uses a dedicated Settings screen with trusted-mint selection,
  authentication, live keyset activity, and separate completed/partial/failed results.
  Mint details opens the same screen. The fixed sheet delay was removed; scan
  range, seed derivation, and proof handling remain unchanged.

## Automated validation

Run the relevant checks from the repository root:

```sh
yarn typecheck
yarn check:structure
yarn check:buttons
yarn test:ci --runInBand --runTestsByPath tests/unit/settings-navigation.test.tsx tests/unit/settings-protected-value.test.tsx tests/unit/settings-backup-actions.test.tsx tests/unit/get-change-screen.test.tsx tests/unit/app-switch.test.tsx tests/unit/change-backup.test.ts tests/unit/nostr-auto-claim-policy.test.ts tests/unit/nostr-receipt-service.test.ts
yarn test:ci --runInBand --runTestsByPath tests/unit/nostr-relay-settings.test.ts tests/unit/settings-relay-ui.test.tsx tests/unit/settings-proof-manager.test.tsx tests/unit/settings-profile-status.test.tsx tests/unit/settings-updates.test.tsx
yarn test:ci --runInBand --runTestsByPath tests/unit/recover-funds-screen.test.tsx tests/unit/wallet-recovery-result.test.ts
```

These cover the header export regression, tab return destinations, switch state,
authentication rejection and backgrounding, backup confirmation/cancellation,
restore ordering, duplicate action taps, offline change review/cleanup, and existing
backup/receiving behavior. The Android development bundle was compiled through Metro.

## Device review still required

Use a disposable test wallet for operations that spend, restore, or delete wallet data.

- Review payment confirmation, ecash/Lightning/on-chain pending screens, requests, final results,
  and transaction details in light/dark mode, narrow screens, and large accessibility text.
  Confirm 32/14-point amounts on pending screens and 40/16 on confirmation/final results/details;
  check long amounts, currency glyphs, QR sizing, and reachable footer controls.
- Confirm existing Status rows appear once and first in pending payment detail lists, with no
  extra Status rows on completed success/failure screens. Check
  pending orange, failure red, status refresh/loading, claim/reclaim, and copy/share actions.
- Verify payment detail and receipt timestamps use the device's local timezone and clock setting:
  `Oct 24, 2026 8:33 PM` for 12-hour or `Oct 24, 2026 20:33` for 24-hour. Switch clock settings,
  reopen details, and check midnight/noon (`12:00 AM`/`12:00 PM` or `00:00`/`12:00`).
  History rows use short relative times and older short dates.
  Countdown formats and chat dates stay unchanged.

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
  verification, blocked people, receiving policy, relay add/remove/reset and status,
  and the read-only Nostr health summary. Confirm relay edits survive restart,
  removed relays disconnect, and reset restores the defaults.
- Check profile/username and existing non-settings entry points, including backup
  warnings and onboarding. Follow website, support, documentation, and legal links.
- Review a large blocked list: search by name/key, select across filters, clear the
  selection, cancel/confirm bulk unblocking, and check large text and screen readers.
- Claim, change, and delete a test username; confirm the verified badge and Claim
  action reflect the registry result. Test proof export and spent-only cleanup in
  a disposable wallet, including cancellation of the native share/confirmation UI.
- Check OTA availability, download progress, retry, and restart in an update-enabled
  build; development builds cannot fully verify the production update flow.
- Toggle automatic mint backup, restart/resume, and change the mint list. Confirm
  quiet publishing, persisted preference/timestamps, manual backup while automatic
  backup is off, and unchanged last-success time if all relays reject publication.
  Restore the same test identity on another device and retrieve its mint list.
- In airplane mode, paste or scan a raw ecash token and save it for later. Confirm
  one pending History entry, unchanged spendable balance, and no new trusted mint.
  Go online and claim through the normal validation/trust flow. Also test losing
  connectivity immediately before a receive tap and failure to write local history.
- In a disposable wallet, open Recover funds from Backup & recovery and mint details.
  Test one mint and all trusted mints, authentication cancellation, offline/partial
  failures, retry, duplicate taps, keyset activity, and updated balances without restart.
  Confirm back navigation stays blocked during recovery and no untrusted mint is scanned.
- Test wallet deletion only after exporting a test wallet; cancel authentication
  and cancel the review before performing a deliberate confirmed deletion.
