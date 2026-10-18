# Android NFC request compatibility

The connected Samsung SM-A546U running Android 16 successfully read and paid a Bey
request. Verification confirmed a successful receive receipt, one History entry
associated with the completed request, a cleared native pending slot, and transaction
details displaying the net amount and an uncovered-fee message.

## Native routing and discovery

Bey advertises the NDEF application AID `D2760000850101`. Other installed wallets can
register that same AID, so enabling the HCE component alone does not ensure Android
routes the tap to Bey. While advertising a request, the native module uses
`CardEmulation.setPreferredService` for the foreground activity. It releases the
preference on stop, pause, and destroy without changing the system's default wallet.
Advertising fails closed when foreground routing cannot be obtained.

The native tests cover application selection, capability-container selection/read,
NDEF selection, length/message reads, failed durable writes, malformed commands,
deactivation, and foreground routing lifecycle. Run `node scripts/test-hce.cjs` with
a JDK available. The Android module was also compiled against SDK 36 during validation.

## Payment completion and receiving fees

A native write is delivery evidence, not proof of successful payment. The pending
offer remains authoritative until an exact successful local receive receipt exists.
Request completion, durable receipt association, and native acknowledgement retain
mint trust, keyset, proof, unit, ownership, age, wallet-lock, and duplicate checks.

The receiver explicitly authorized accepting the requested face value even when the
sender does not cover receiving fees. Fees must be valid and net received value must
be positive. Requested amount, fee, net amount, and fee coverage are recorded on the
same successful receipt; net plus fee must equal its stored gross input value.
History and transaction details show the validated net amount. If the sender did not
cover the fee, details explains that it was deducted from the payment. No extra
History entry is created for fee accounting or request completion.

The original request stays fixed while its offer needs review. A new QR request can
still be created, but NFC remains paused while an unresolved offer occupies its
single durable slot. An unlocked foreground check releases stale review if that
authoritative slot is empty. Successful completion opens the existing transaction
details screen for the exact verified receipt.

## Investigation and recovery notes

The earlier apparent NDEF failures occurred while advertising was paused by a saved
offer. Recreating a wallet removed its request database but left the native offer in
Android's no-backup storage. Two offers were preserved manually on the development
phone before further testing:

- `no_backup/nfc-payment-before-wallet-reset-20261018.json`
- `no_backup/nfc-underpaid-before-minibits-20261018.json`

These files remain private on the device. They were not marked paid, overwritten,
printed, or copied off the phone. This was a one-time recovery operation, not an
automatic wallet-reset archive feature. The final saved payment was successfully
redeemed through the normal coordinator after receiver-covered fees were authorized.

The temporary diagnostics UI, native recorder and bridge methods, and dedicated EAS
profile have been removed. The UI removal loads through Metro; removing the native
recorder from an already installed APK requires a rebuilt development client.

Interrupted-contact/retry, duplicate-payment device acceptance, and other sender/device
pairings still need device checks. No seeds, key derivation, or recovery semantics
were changed.
