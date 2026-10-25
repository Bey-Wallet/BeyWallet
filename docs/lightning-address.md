# Lightning address receiving

Lightning address is opt-in under Settings → Wallet & payments. Select a connected,
trusted SAT mint supporting NUT-04 BOLT11 minting and NUT-09 restore, then enable
the address. Automatic collection defaults to enabled and has its own preference.
The receiving mint is independent of Home's selected mint. Provider changes are
confirmed remotely before the local preference changes, and affect future invoices.
Disabling collection does not revoke an address already shared.

My addresses preserves the Ecash identity, npub card and Nostr verification. Its
Lightning tab uses `npub1…@npub.cash` for Copy/Share and a bech32 LNURL encoding of
`https://npub.cash/.well-known/lnurlp/{npub}` for QR payments. It does not use the
wallet's `bey.cash` username as an alias. Existing profile routes remain supported.

## Storage and collection

`LightningAddressService` owns serialized discovery and collection. Preferences are
SQLite settings scoped to the wallet public key. Discovery checkpoints are scoped
to provider and public key; receipts are keyed by public key, mint URL and quote ID
across providers. Every discovery batch is recorded transactionally before its
checkpoint advances, overlapping the previous checkpoint second. SDK 0.3.2 handles
the provider's 50-quote pagination.

Quotes never enter Coco's automatic mint quote processor. Bey checks the mint's
actual quote, trust, unit, amount and lock before issuance, allocates deterministic
outputs through Coco's proof/counter service, and persists those exact outputs.
Submitted claims restore those outputs before any retry. Validated unspent proofs,
normal mint History and the completed collection marker commit in one transaction.
Balance/history events follow that commit. Deleting visible History does not remove
the receipt marker. Unknown mints and mismatched quote locks remain pending.
The provider's locking preference is never modified.

`lightningAddressLifecycle` uses deferred imports at the initialization boundary.
Listening requires loaded preferences, an initialized Settings store, foreground,
connectivity and an unlocked wallet. Disabling, backgrounding, locking or stopping
invalidates the session and removes subscriptions/timers. Submitted issuance drains
before wallet disposal; it retains prepared outputs if saving cannot complete.
Update bursts are debounced and synchronization is serialized. Reconnects back off
from one second to 30 seconds, with a 30-second polling watchdog. SDK close signals
are observed through a silent logger; keys, JWTs, quote IDs and proofs are not logged.
JWTs live only in client memory. Authentication accepts only the configured providers
and expected API/NIP-98 endpoints. No metadata publishing or background service is added.

The explicit **Check previous npubx.cash address** action uses a separate discovery
checkpoint and leaves that provider's account settings unchanged. Identical quotes
across providers share a collection marker. Existing Coco proofs, quote records and
History remain intact. Issued quotes without local prepared outputs require mint
recovery; remote issuance alone never creates local credit.

## Android acceptance checks

These require a device and a separate Lightning payer:

- Enable with a compatible trusted mint; verify the LNURL QR and readable address.
- Receive an ordinary payment and a zap while open; check one History entry and balance.
- Close Bey, pay, reopen and unlock; confirm catch-up and one-time collection.
- Turn off automatic collection; confirm pending receipts and Collect / Collect all.
- Switch Home's mint, then the receiving mint; confirm their independence and that
  existing invoices collect from their original mint.
- Disable/re-enable; confirm QR hiding, preserved pending claims and continued validity
  of previously shared addresses.
- Interrupt issuance before and after the mint responds, then reopen; confirm recovery
  uses the recorded outputs, with no lost funds or duplicate credit.
- Check offline, reconnect, app lock, background, large text, light/dark themes and
  previous-provider recovery. Confirm quote locking remains enabled when configured.

Provider behavior references: [receiving model](https://docs.npub.cash/docs/getting-started.html)
and [API reference](https://docs.npub.cash/docs/api/endpoints.html).
