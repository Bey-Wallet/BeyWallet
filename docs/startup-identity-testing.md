# Startup and Nostr identity regression checks

The notification revamp gated navigation behind full wallet initialization. Network watcher setup
could therefore delay Home and show a new full-screen spinner. Separately, Settings marked itself
initialized after exhausting repository retries, or when no wallet existed during onboarding. That
could leave the in-memory Nostr identity empty for the rest of the session.

Home now mounts once the local manager and privacy/authentication settings are loaded, before
network watcher initialization completes. The native launch splash covers this local preparation;
there is no extra app startup spinner. NFC remains unavailable until wallet initialization completes.
Local startup failure has a safe retry screen instead of a permanent splash. No seed derivation,
payment execution, or fund-recovery algorithm was changed.

Settings hydration is explicitly retried when the local repositories are ready. Missing Nostr key
cache entries use the existing recovery-phrase derivation. Existing complete cached identities are
preserved. Missing identity has a retry action in Settings, and secret-key reveal retries loading
before displaying its existing authenticated error. No identity material is logged.

## Manual directions

Use an updated development or preview build. Do not clear storage or delete your real wallet to
test this fix.

1. In **Settings → Profile & identity → Public key**, copy the public key and keep it for comparison.
   Confirm your recovery phrase backup separately under **Settings → Backup & recovery**. Never
   share your phrase or secret key with support.
2. Close Bey completely and reopen it several times. Expect the native launch splash followed by
   Home (or the biometric lock), without a separate centered app startup spinner. Compare the key
   after every launch: it must stay identical. Record startup duration; this change has not been
   timed on physical devices in this workspace.
3. Enable airplane mode and repeat. Slow/unreachable mints must not hold Home behind watcher setup.
   Keep biometric lock enabled for one run and hidden balances enabled for another. Verify there
   is no visible balance or unlocked-content flash before authentication/settings load.
4. If the public key is unavailable, open the public-key screen and tap **Retry loading public key**.
   A successful retry must show the same identity, not a new key. If it cannot load, expect an
   inline retryable error; the copy control must stay disabled while no public key exists.
5. Reconnect and verify Nostr messages, incoming-payment review, and Lightning-address status
   become available. Check a small payment only after the wallet is ready. Pending or unavailable
   services must not be described as successful payments.
6. On a separate disposable test wallet, test creating/importing a wallet and going directly to Home
   without restarting. Its public key must be present and remain the same after a restart. Restoring
   the same recovery phrase in an isolated test installation should reproduce the same public key.
7. If startup encounters a local read error, expect **Retry opening wallet** instead of an endless
   spinner/splash. Retrying must not delete or recreate the wallet. Automated tests inject these
   failures; do not corrupt a real wallet database to reproduce them manually.

Android/iOS device startup timing, lock/privacy rendering, and Nostr reconnection remain pending
physical-device verification. These changes do not add closed-app payment delivery.

## Local validation

- 10 focused suites, 42 tests passed: startup, identity retry, settings/notification preferences,
  Nostr scheduling/identity, recovery, backup actions, notification permissions and navigation.
- Typecheck, structure check (73 routes), button check, scoped Prettier, and diff whitespace check passed.
- Code changed: `src/shared/layout/RootLayout.tsx`, `src/services/wallet/initService.ts`,
  `src/state/settingsStore.ts`, and `src/features/settings/IdentityScreens.tsx`.
- Regression tests: `tests/unit/root-startup.test.tsx`, `tests/unit/identity-retry.test.tsx`, and
  `tests/unit/notification-preferences.test.ts`.
