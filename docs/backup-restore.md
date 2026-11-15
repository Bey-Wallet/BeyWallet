# File backup and restore

Settings and onboarding use the same validated file restore service. Seed-phrase
scanning is a separate flow; this change does not alter seed/key derivation.

Version 4 exports preserve send/melt operation journals, melt quotes, keypairs,
proof reservations, counters and maintenance journals alongside the existing mint,
proof and history records. Older supported Bey record layouts default absent
operation tables to empty arrays. A legacy file cannot reconstruct records that
were never exported. Unknown columns, malformed records and newer unsupported
versions are rejected before activation.

The recovery phrase selects the restore behavior:

- Same BIP39 identity: stage a copy of the entire current database and insert only
  missing records. Existing proof states, payment states, mint trust and settings
  win conflicts; counters use the maximum. History IDs are local, so history is
  deduplicated using mint/type and operation, quote or token references.
- Different identity: stage a fresh database. The user explicitly chooses
  **Finish and replace wallet**; balances are not combined. The previous wallet's
  funds remain separate and require its own external backup after replacement.
- No existing wallet: stage a fresh database and finish onboarding only after
  the replacement is installed.

New non-spent proofs are checked with NUT-07 before import. Responses must cover
the requested proof Ys exactly. SPENT proofs remain spent; PENDING/reserved proofs
remain in flight. Known local proofs are never overwritten by an old file. Before
activation, proof states are checked again because preparation may have survived
a long app suspension. Unavailable/incomplete mint responses abort preparation
or completion and preserve the original wallet; reconnect before retrying.

## Durable replacement

The app pauses recovery/background work, stops the old runtime and uses Expo
SQLite's backup API to preserve a consistent original database, including WAL
contents. It imports into a separate staging database and checks SQLite integrity.
Neither preparation nor the review step replaces the active database or phrase.

An encrypted SecureStore journal holds the transition phase, original/new phrases
and the previous onboarding flag. Installation writes the journal before changing
the active database or phrase. An interrupted installation copies the original
database back and restores its phrase/onboarding flag; rollback can itself be
repeated after interruption. Missing recovery files fail closed.

The whole navigator is replaced by a restore gate during this process, including
on relaunch. Existing-wallet completion authenticates again. After explicit
completion, the app restarts to discard all identity-specific stores, cached
queries and native/runtime references. Startup opens the installed wallet locally
without network plugins; only after local settings/identity initialization succeeds
does it commit and delete the original snapshot. Normal network work starts after
that commit. Cleanup after a committed restore is retryable and never rolls the
new wallet back. Cancellation restarts into the unchanged original wallet.

Successful completion and cancellation reopen the wallet automatically with a
centered spinner and status message. A manual reopen action is shown only if
automatic reloading fails or a recovery error needs to remain visible.

After successful local initialization and activation, a **Backup restored** result
confirms success with an **Open wallet** action. Review and result screens use
the app typography, neutral grouped surfaces and full-width BUI-backed buttons
in a safe-area footer outside their scrollable content. Preparation and errors
never display the success result.

Before confirmation, the review shows the staged wallet's available balance and
each mint's name, URL and available balance. Pending/reserved funds are shown
separately and spent proofs are excluded. A same-phrase merge labels this as the
resulting wallet balance, including existing funds; replacement shows only the
restored wallet. The preview is rebuilt from staging after relaunch and contains
no proof secrets or private keys.

Backups keep the existing plaintext JSON format. This work does not add backup
encryption or transfer/redeem funds between the old and restored identities.

## Physical-device acceptance

- Export with pending ecash sends and Lightning payments; inspect only synthetic
  test files and confirm the operations, quotes, reservations and counters survive.
- Restore an older same-phrase backup after spending part of its balance. Confirm
  spent coins do not return and existing pending payment states do not regress.
- Restore a different phrase; cancel the final review and confirm the original
  balance, identity, contacts and preferences remain intact after restart.
- Finish replacement; confirm the restored identity, balance, history and settings
  after restart, with no old contacts, query results, NFC sessions or notifications.
- Kill the app during staging, during database copy, after phrase persistence and
  before the installed marker. Confirm recovery uses the original database/phrase
  together and requires a restart before opening the navigator.
- Kill after the installed marker and during old-snapshot cleanup. Confirm startup
  opens the new wallet or retries cleanup without reverting a committed wallet.
- Test insufficient disk space, storage permissions, offline/unreachable mints,
  malformed files, cancelled biometrics and devices using passcode fallback.
- Test first-run file restore, cancellation and failure without completing
  onboarding; verify the normal seed-phrase onboarding flow still works.

Automated tests exercise the import rules with real SQLite and fault injection at
journal transitions. Native SQLite backup behavior, process termination, device
authentication, file pickers and restart behavior still require the checks above.
