# Nostr and People manual test checklist

Use this checklist for changes to People, Nostr identity, social payments, claim processing, or
relay diagnostics. Record the platform, OS version, app build, and mint/relay test environment in
the pull request. Use test funds only.

Automated unit tests cover pure migration, sorting, resolution, history, claim, and diagnostic
logic. The scenarios below exercise native storage, authentication, network transitions, relays,
notifications, and complete payment flows.

## Preparation

- [ ] Install a development build on the target device.
- [ ] Back up any test wallet recovery phrase without placing it in logs or screenshots.
- [ ] Configure at least one trusted test mint with a small test balance.
- [ ] Have a second test Nostr identity available for send and receive scenarios.
- [ ] Confirm the test identity has reachable relays and, when needed, a resolvable NIP-05 address.

## People and profiles

- [ ] Search for a valid npub and open the returned profile.
- [ ] Search for a valid NIP-05 identifier outside the `bey.cash` domain.
- [ ] Confirm an invalid npub or unresolved NIP-05 produces a safe error state.
- [ ] Confirm the verified badge appears only when NIP-05 resolves to the displayed npub.
- [ ] Favorite and unfavorite a person, restart the app, and confirm persistence.
- [ ] Pull to refresh and confirm stale profile metadata updates.
- [ ] Confirm Recents ordering changes after a payment interaction.
- [ ] Confirm the person detail screen only shows Nostr payments associated with that person.

## Upgrade migration

- [ ] Upgrade an installation containing legacy contacts and favorites.
- [ ] Confirm contacts appear in People without duplicates.
- [ ] Confirm legacy favorites remain favorites.
- [ ] Restart the upgraded app and confirm the migrated state remains stable.

## Sending

- [ ] Send a small Nostr payment to a directly entered npub.
- [ ] Send a small Nostr payment to a recipient resolved through NIP-05.
- [ ] Confirm the recipient and status appear in transaction and person history.
- [ ] Confirm cancellation or relay failure does not incorrectly report success.

## Receiving and claims

- [ ] Receive a payment from a trusted mint and confirm it is claimed once.
- [ ] Confirm the balance, history, and optional notification update after the claim.
- [ ] Receive a payment from an unknown mint and confirm approval is required before trust or claim.
- [ ] Reject or leave the unknown-mint payment pending and confirm no mint is silently trusted.
- [ ] Lock the wallet before receipt, then unlock it and confirm the deferred claim resumes.
- [ ] Receive while offline, restore connectivity, and confirm the persisted retry completes.
- [ ] Exercise a non-retryable invalid or P2PK failure and confirm it appears under Attention.
- [ ] Reopen or redeliver the same event and confirm it is not credited twice.

## Diagnostics and repair

- [ ] Confirm a healthy identity reports matching NIP-05, profile, inbox relays, and reachable relays.
- [ ] Test a mismatched or unavailable NIP-05 result without altering wallet keys.
- [ ] Repair missing profile metadata and confirm a new check detects it.
- [ ] Repair a missing inbox relay list and confirm the expected relays are published.
- [ ] Disconnect and reconnect networking and confirm relay health updates without crashing.

## Platform checks

- [ ] Verify biometric or device authentication before revealing the Nostr secret key.
- [ ] Confirm the secret key is hidden again after leaving the relevant screen.
- [ ] Verify notification behavior in foreground and background where supported.
- [ ] Check the affected screens in both light and dark themes.
- [ ] Repeat payment-critical scenarios on both Android and iOS when the change is cross-platform.

## Report

Include passed and failed scenarios, remaining unverified platforms, and any relay or mint
limitations in the pull request. Never attach secret keys, recovery phrases, raw ecash tokens, or
proofs.
