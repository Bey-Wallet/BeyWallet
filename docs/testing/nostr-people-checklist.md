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
- [ ] Accept a person, restart the app, and confirm accepted status persists.
- [ ] Open/search/share unknown profiles and confirm they remain unaccepted.
- [ ] Pull to refresh and confirm stale profile metadata updates.
- [ ] Confirm Recents ordering changes after a payment interaction.
- [ ] Confirm the person detail screen only shows Nostr payments associated with that person.

## Upgrade migration

- [ ] Upgrade an installation containing legacy contacts and favorites.
- [ ] Confirm contacts appear in People without duplicates.
- [ ] Confirm legacy contacts/favorites are unaccepted and remain searchable, with metadata/history intact.
- [ ] Inspect rewritten People storage: no favorite maps or fields remain.
- [ ] Restart the upgraded app and confirm the migrated state remains stable.

## Sending

- [ ] Send a small Nostr payment to a directly entered npub.
- [ ] Send a small Nostr payment to a recipient resolved through NIP-05.
- [ ] Confirm the recipient and status appear in transaction and person history.
- [ ] Confirm cancellation or relay failure does not incorrectly report success.

## Receiving and claims

- [ ] In Ask mode, receive from an unknown person at a trusted mint: no redemption, balance change or receipt notification.
- [ ] Accept the invitation and confirm all eligible waiting payments are claimed once.
- [ ] Repeat using a payment responding to a request created by this wallet; acceptance is still required.
- [ ] Confirm the balance, history, and optional notification update after the claim.
- [ ] Receive a payment from an unknown mint and confirm approval is required before trust or claim.
- [ ] Reject or leave the unknown-mint payment pending and confirm no mint is silently trusted.
- [ ] Lock the wallet before receipt, then unlock it and confirm the deferred claim resumes.
- [ ] Receive while offline, restore connectivity, and confirm the persisted retry completes.
- [ ] Exercise a non-retryable invalid or P2PK failure and confirm it appears under Requests as a payment issue.
- [ ] Reopen or redeliver the same event and confirm it is not credited twice.
- [ ] Switch to Accept everyone with waiting invitations: contacts become accepted, eligible offers claim, unknown mints still require approval.
- [ ] Switch back to Ask and confirm accepted contacts remain accepted.
- [ ] Reject and block, replay events, restart and retry with mint approval: blocked payments remain unclaimed.
- [ ] Unblock in Nostr Settings: status becomes unaccepted and requires explicit acceptance, including in Everyone mode.
- [ ] Block during a slow pre-redemption lookup; confirm no new redemption starts. A submitted redemption may finish.

## Persistent text conversations

- [ ] Exchange text Bey↔Bey and Bey↔Minibits using published kind 10050 inbox lists; verify both directions.
- [ ] Confirm missing inbox lists give an actionable error without falling back to legacy outgoing chat.
- [ ] Receive signed legacy kind 4 text; reject invalid seals, signatures and wrong recipients.
- [ ] Confirm sender copies appear as outgoing and never trigger payment claims.
- [ ] Replay the same rumor in multiple wraps: one message remains after restart.
- [ ] Mix payments and text, confirm chronological order and contact/mint/claim statuses; tokens/proofs never appear as chat text.
- [ ] Disconnect during publication: Failed persists after restart; retry reuses the logical message and does not create duplicate bubbles.
- [ ] Interrupt a Sending message by closing the app: reopen and manually retry the persisted item.
- [ ] Scroll through more than 50 messages and inspect older local messages beyond the seven-day relay window.
- [ ] Verify Recent ordering, preview/time/unread, grouped Requests and payment issue badges without duplicate invitations.
- [ ] Verify keyboard/composer layout, screen-reader labels, large text and light/dark themes on Android and iOS.
- [ ] Type past four lines: the composer stops growing and scrolls internally; Request and Pay remain below it.
- [ ] Send while relay discovery is slow: the message appears after local save, the composer clears, and another message can be drafted/sent while publication is pending.
- [ ] Tap a text or payment body: details/copy/time appear in a bottom sheet; detailed timestamps stay out of the timeline and payment secrets never appear in copied text.
- [ ] Confirm sent text is white on dark, sent payments branded secondary, received items secondary, and actionable incoming payments warning-colored; amounts follow primary/secondary currency settings.
- [ ] Tap the contact header: inspect full avatar/address and npub; copy, share, sync, delete and block work without a QR screen.
- [ ] Change the contact's profile picture and sync; change address resolution to another pubkey and confirm the saved contact key never changes.
- [ ] Open an old person-details link and confirm it opens the unified conversation.
- [ ] Delete the test wallet and confirm no message memory or local text survives into a new wallet.

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
