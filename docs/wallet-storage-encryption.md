# Wallet database encryption

Native wallet storage uses the SQLCipher already bundled with Expo SQLite 16.0.10.
No npm dependency is added. Android's SQLCipher override is enabled in `app.json`;
a new native development/production build is required. Metro reloads cannot add
SQLCipher. Builds without it stop before onboarding or recovery can create wallet data.
Web and Expo Go do not provide this native storage capability.

## New installations and performance

A fresh installation generates 32 random bytes through Expo's native
`getRandomValues`, saves the hex key in SecureStore and reads it back before creating
the database. It creates the encrypted database directly: no migration, password
prompt, JavaScript password stretching or balance scan is required.

The key is passed as SQLCipher raw key data, preserving native page encryption and
authentication without deriving a key from a human password. See the
[SQLCipher raw-key API](https://www.zetetic.net/sqlcipher/sqlcipher-api/#example-2-raw-key-data-without-key-derivation).
The app never logs the key or propagates SQL exceptions containing key statements.
SecureStore uses `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`; biometric app lock remains
separate. Database keys are device-local, independent of recovery phrases.

Normal queries retain the existing WAL, cache and busy-timeout settings. A schema
read validates the key on open; full integrity scans are limited to conversion and
restore copies, where they run before replacing the destination.
Native encryption still has some overhead. Android startup, first wallet creation,
receive/payment recording and restore timings have **not** been measured on a device.

## Existing data and recovery

`coco_wallet.db`, `bey_file_restore_original.db` and `bey_file_restore_staged.db`
map to corresponding `_encrypted.db` files. Old filenames remain untouched while
`sqlcipher_export` creates a temporary encrypted copy. A transaction protects the
source snapshot. Schema version, every application-table row count, SQLite integrity
and SQLCipher page authentication are checked before promotion. The installed copy
is reopened and checked before deleting the old database and its WAL/SHM/journal.

An interrupted export can retry from the legacy source. An existing encrypted file
is authoritative and never falls back to stale plaintext. Missing/malformed keys,
orphaned sidecars and unreadable databases fail closed without generating a new key
or resetting a wallet. Deleted legacy files cannot be guaranteed forensically erased
from flash storage.

Restore journals keep their existing transition semantics. Active, staging and
rollback handles all use the same keyed boundary. Existing recovery snapshots are
converted before startup recovery. Native SQLite backup operates only between two
keyed handles. Each copy validates its source before recreating its destination,
allowing an interrupted/corrupted installation to roll back from the preserved original.

Explicit wallet deletion closes storage, removes encrypted and legacy copies and
sidecars, then removes the database key. Failed file deletion retains the key and
reports failure before clearing the recovery phrase. Deletion intent is durably
recorded so startup can finish an interrupted deletion
before it can recreate an empty database alongside an old recovery phrase. The
marker clears only after the files, database key and recovery phrase are gone.
Android automatic application backup is disabled; explicit cloud/device-transfer rules also exclude SQLite files and
SecureStore to prevent restoration of databases without their device-bound key.
User-exported backup files remain unchanged and unencrypted; this work does not
reintroduce password-protected file backups.

Privacy & security shows a read-only **Wallet storage: Encrypted** row only after
the native encrypted active database opens. There is no enable/disable toggle.

## Other wallet implementations inspected

Source snapshots checked on 2026-11-16. These observations describe the examined
default-branch source, not an audit or a guarantee about every released binary.
Secure key storage and full database encryption are different properties; absence
of an application SQLCipher call does not establish the absence of OS disk protection.

- **Cashu.me native Android**, `cashubtc/wallet` at `e61dcb3`: CDK's
  `WalletSqliteDatabase(databasePath)` opens the wallet repository. A separate
  [AndroidSecureStorage](https://github.com/cashubtc/wallet/blob/e61dcb3c2c898561bab2e997a08dcb3c008e0b43/android/app/src/main/java/com/cashu/me/Core/Platform/AndroidSecureStorage.kt)
  encrypts secure values with AES-GCM and an Android Keystore key, with no required
  user-authentication prompt. The examined
  [CDK gateway](https://github.com/cashubtc/wallet/blob/e61dcb3c2c898561bab2e997a08dcb3c008e0b43/android/app/src/main/java/com/cashu/me/Core/CDK/CdkWalletGatewayImpl.kt)
  passes the database path without a database encryption key. This is the native
  app, not the separate Vue/Capacitor PWA repository.
- **Macadamia**, `zeugmaster/macadamia` at `47f4726`: uses SwiftData's
  [ModelContainer in an iOS app group](https://github.com/zeugmaster/macadamia/blob/47f4726a6197ef61fb7660b7469f7502d7c58951/macadamia/PersistentModelV1/PersistentModelV1.swift).
  Wallet mnemonic/seed, proofs and related records are SwiftData model fields. No
  SQLCipher key or application-layer database cipher was configured in that examined
  initialization/model path. The exact OS file-protection class was not established.
- **Minibits**, `minibits-cash/minibits_wallet` at `eefdfb9`: opens
  [`minibits.db` through op-sqlite](https://github.com/minibits-cash/minibits_wallet/blob/eefdfb9e055968135a1a9314b637798500360acd/src/services/db/instance.ts)
  without an `encryptionKey`. Its
  [connection adapter](https://github.com/minibits-cash/minibits_wallet/blob/eefdfb9e055968135a1a9314b637798500360acd/src/services/db/connection.ts)
  accepts that optional parameter, but the examined caller does not pass it. This
  does not describe all separately protected seed/key storage or backups.
- **Sovran**, `SovranBitcoin/Sovran` at `c6495cb`: opens account databases with
  [Expo SQLite and Coco repositories](https://github.com/SovranBitcoin/Sovran/blob/c6495cbc0604a547421f714bb8f6ffd49910c34d/app/shared/lib/cashu/manager.ts),
  with no SQLCipher configuration/keying found in that path or its Expo plugin
  configuration. Mnemonics and derived/private keys use a separate
  [Expo SecureStore layer](https://github.com/SovranBitcoin/Sovran/blob/c6495cbc0604a547421f714bb8f6ffd49910c34d/app/shared/lib/nostr/secureStorage.ts),
  deliberately without biometric prompts on each startup read.

## Required native-device acceptance

Use a disposable wallet and a newly built Android dev client first. Do not treat
mocked unit tests as evidence that the native database is encrypted.

1. Fresh installation: create, restart and open a wallet; confirm no extra prompt,
   no migration export and an Encrypted status row. Measure launch/setup time.
2. Verify the database has no readable SQLite header/proof text, plain SQLite
   cannot open it, and the correct SQLCipher key can open it. Never log/share that key.
3. Upgrade a populated plaintext installation with pending sends/payments. Confirm
   balances, reservations, counters, histories, settings and schema versions survive.
4. Interrupt export, rename, plaintext-file cleanup and restart. Test disk-full and
   storage failures. Confirm the preserved source is recoverable without an empty reset.
5. Restore same/different phrases, cancel review and finish replacement. Interrupt
   installation and confirm rollback works with encrypted original/staged files.
6. Simulate missing/wrong keys in a disposable fixture; confirm startup fails closed.
   Delete a disposable wallet and verify all copies/sidecars and its key are removed.
7. Measure balance queries, payment recording and restore with a larger wallet.
   Verify Android backup exclusion in the generated manifest. Align release OTA
   runtime compatibility with the new SQLCipher binary before publishing updates.
