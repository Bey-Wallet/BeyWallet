# Recovery speed and authentication investigation

Investigated 2026-11-09 against Bey commit `a0e4ac3`. No recovery, authentication,
derivation, dependency, or storage behavior was changed during this investigation.
The subsequent changes are described in [the implementation notes](recovery-implementation.md);
the findings below describe the original implementation.

The user confirmed that the Cashu.me comparison is seed-phrase recovery on the same
mint, rather than backup-file import. The installed Cashu.me build, Android timings,
keyset counts, and scanned counter ranges have not been captured. Source differences
are verified below; their shares of the observed wall-clock delay are not measured.

## Main performance finding: repeated cryptographic work

Bey declares `@cashu/cashu-ts: ^3.3.0`, with 3.6.4 installed at the project root.
However, Coco 1.1.2-rc.47 has its own nested **cashu-ts 3.3.0**. Coco constructs the
wallet used by recovery, so that nested implementation matters for this path.

In that implementation, `OutputData.createDeterministicData` synchronously constructs
every output in a batch. For each legacy BIP32 output, secret derivation and blinding
factor derivation each recreate the master HD key and walk the shared path again.
This repeats expensive elliptic-curve work hundreds of times within one batch.

Cashu.me's audited public main snapshot targets cashu-ts `^4.9.0`. The 4.9.0 source
creates a shared keyset-parent deriver once per batch, then derives the secret and
blinding factor together for each counter. This preserves the deterministic result
while avoiding repeated parent derivation. It is a concrete library implementation
difference, not evidence that changing the recovery seed or derivation standard is safe.

A synthetic local probe compared Bey's installed nested implementation with the
equivalent shared-parent legacy derivation using its existing BIP32 dependency:

- Runtime: Node v24.10.0 on this workstation, not Android/Hermes.
- Input: 200 counters using a public synthetic seed and synthetic legacy keyset ID.
- Existing separate derivations: 953 ms in one run.
- Shared-parent paired derivations: 278 ms in that run.
- Both derived byte arrays matched for all 200 counters.

This measures derivation only. It excludes network requests, blinded-message generation,
signature unblinding, proof-state checks, and SQLite. It is neither an end-to-end speedup
claim nor an Android benchmark. A second probe constructing 200 complete deterministic
outputs took 1,241 ms for a synthetic legacy keyset versus 153 ms for a synthetic HMAC
keyset on this workstation. These schemes are selected by keyset version: they must
never be substituted for each other to make recovery faster.

## Other verified costs and limitations

- `RecoveryCoordinator.enqueue` serializes selected mints and waits for currently active
  receiving/maintenance work before scanning. This is a correctness boundary; measure
  the wait before considering changes.
- `walletService.restore` scans SAT-compatible active and inactive keysets sequentially.
  The SDK starts at counter zero, including on retries. There is no persisted scan cursor
  for resuming incomplete keyset work.
- The wrapper yields between keysets, but the SDK generates a 200-output batch
  synchronously before its network request. Deferring with InteractionManager does not
  move cryptography to another JavaScript thread.
- SQLite proof saving performs one existence query per proof and then one insert per
  proof, within a transaction. This is additional per-proof work; its actual cost on
  the device remains unmeasured.
- Progress currently reports the mint/keyset being scanned, rather than output-batch
  preparation, restore requests, or proof-state checking. Proof-save events can refresh
  balances during a scan, so balance display is not strictly delayed until all mints finish.

Both wallets use sequential recovery in the audited source and both use 200-output
batches. Cashu.me waits for **two** consecutive empty batches; Bey's current 200-gap,
200-batch configuration stops after **one**. Thus, a claim that Cashu.me is faster simply
because it scans fewer empty outputs or runs the entire recovery in parallel is unsupported.
Do not reduce Bey's scan coverage or skip inactive keysets as a speed shortcut.

Cashu.me's public app is a PWA. If that is the Android installation used for comparison,
its browser JavaScript engine differs from Bey's React Native runtime. Runtime differences
could amplify the crypto cost, but that has not been measured on the user's device.

## Recovery contract issues found while tracing the path

1. The preload branch in `walletService.restore` reads `unsafeManager.keysetRepository`
   and checks for `getKeysets`, `updateKeysetKeys`, and `saveKeyset`. The installed
   Manager does not expose that repository there, and Bey's repository exposes different
   method names, including `getKeysetsByMintUrl`. Consequently, the advertised key
   preloading branch does not perform its intended work. With SDK 3.3.0, missing inactive
   keyset keys can produce partial recovery failures. Cashu-ts 4.9.0 explicitly ensures
   the requested keyset's keys in its restore path.
2. Coco's `restoreKeyset` loads existing proofs but passes all restored ready proofs to
   `saveProofs`. Bey's repository rejects an already stored proof. A keyset containing
   both known proofs and newly recovered proofs can therefore fail the save transaction.
   Cashu.me explicitly filters already stored proofs before adding them. This should be
   reproduced with a repository/SDK contract regression before changing persistence.
3. The installed Coco recovery uses `overwriteCounter` after scanning, rather than a
   monotonic advance, and treats signature index zero as falsy. Its counter handling
   needs regression coverage for existing high counters and a signature at index zero.
   Cashu.me's audited source uses an advance-to-at-least operation. Counter safety must
   be retained while making repeated recovery idempotent.

These are recovery correctness findings, not measured explanations for every second of
the user's delay. Existing unit tests mostly mock the SDK/repository boundary and do not
exercise all of these real contracts.

## Why authentication is requested

`RecoverFundsScreen.recover` explicitly calls
`biometricService.authenticateAsync('Authorize fund recovery')` before scanning.
The call is unconditional with respect to `biometricEnabled` and `isAuthenticated`.
Retrying incomplete mints follows the same gate. Device-passcode fallback is allowed.

Git history places this prompt in commit `854a252`, which introduced the Settings
Recover Funds feature. This is an additional app authorization safeguard; it is not a
Cashu protocol requirement or an SDK requirement. Recovery does write proofs and counters,
so treating it as a protected wallet operation is reasonable, but the extra prompt is an
app security-policy choice.

The screen already reads the mnemonic from SecureStore and derives the public wallet
identity while preparing its selection view, before this prompt. `seedService.getMnemonic`
does not request SecureStore's `requireAuthentication` option. Thus the prompt is not what
technically unlocks seed access in this flow.

A possible UX policy is to require an unlocked wallet and respect the app-lock setting,
without forcing another prompt for every recovery or retry. Fresh authentication for
revealing secrets, exporting a secret-bearing backup, replacing the wallet, or deleting it
is a separate decision. Changing this recovery gate requires an explicit authentication
policy decision; it was left intact in this investigation.

## Recommended implementation order

1. Add focused contract coverage for old/inactive keysets, duplicate proofs, partial saves,
   counter monotonicity, and counter zero. Repair the incorrect repository boundary.
2. Optimize repeated legacy derivation without changing derived bytes, gap coverage,
   proof validation, or counter safety. Assess a compatible upstream SDK route first;
   a major dependency upgrade needs approval and broader payment regression coverage.
3. Measure queue wait, batch cryptography, restore HTTP, state-check HTTP, persistence,
   first verified balance, and full-scan completion separately. Use aggregate timings only;
   never record seeds, private keys, tokens, proof secrets, or messages.
4. Improve batch-level progress and safely coalesce redundant refreshes. Consider resumable
   scans only with clear full-rescan behavior and recovery-completeness tests.
5. Apply the agreed authentication policy independently of performance changes.

Repeat device comparisons with the same seed, mint, keyset scope, network, and recovery
entry point, using normal preview/release builds. Do not erase a funded wallet for testing.
No seconds-level completion promise can be made before that comparison.

## Source references

- Bey orchestration: `src/state/walletStore.ts`, `src/services/wallet/recoveryCoordinator.ts`.
- Bey scan wrapper: `src/services/wallet/walletService.ts`.
- SDK scan/persistence: installed `node_modules/coco-cashu-core/dist/index.js`,
  `WalletRestoreService.restoreKeyset` and `CounterService.overwriteCounter`.
- Bey storage: `src/storage/sqlite/repositories/ProofRepository.ts` and
  `src/storage/sqlite/repositories/KeysetRepository.ts`.
- Authentication: `src/features/settings/RecoverFundsScreen.tsx`,
  `src/services/platform/biometricService.ts`, `src/services/platform/seedService.ts`.
- [Cashu.me restore implementation, audited snapshot](https://github.com/cashubtc/cashu.me/blob/002a0a367966ffda04bb29d1ca888fcbcd070e16/src/stores/restore.ts).
- [Cashu.me dependency declaration, same snapshot](https://github.com/cashubtc/cashu.me/blob/002a0a367966ffda04bb29d1ca888fcbcd070e16/package.json).
- [Cashu-ts 4.9.0 deterministic output construction](https://github.com/cashubtc/cashu-ts/blob/d3e1744728a2ab9c37c63c19224d8fe15162ac06/src/model/OutputData.ts).
- [Cashu-ts 4.9.0 shared deterministic deriver](https://github.com/cashubtc/cashu-ts/blob/d3e1744728a2ab9c37c63c19224d8fe15162ac06/src/crypto/NUT13.ts).
- [Cashu deterministic recovery specification](https://github.com/cashubtc/nuts/blob/main/13.md).
