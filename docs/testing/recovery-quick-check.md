# Quick recovery test

Use a disposable wallet/device profile or a small test balance. Do not erase your funded
wallet just to measure recovery, and never paste a seed, token, proof, or private key into logs.

1. Reload the development client after these edits. For fair timing against Cashu.me,
   also test an ordinary preview/release APK on the same device, mint, and network.
2. Restore the same test seed. Leave **Settings → Network → Nostr history → Load older
   activity** off. Old Nostr messages and payment offers should not fill People or History.
   Mint discovery and the recovery mint-selection screen should still work.
3. Start Recover funds for the same mint. With app lock off, or an already unlocked wallet,
   there should be no extra biometric prompt. If app lock is enabled and the wallet is locked,
   authenticate first; cancelling must not start recovery.
4. Record time from pressing Recover until the first verified balance appears, and until
   completion. One spinner should remain visible through scanning and final balance refresh.
   The same checkbox list must remain visible. Checkboxes and navigation are locked during
   recovery. There should be no percentage, progress bar or recovery hero card. Only fully
   checked mints become green; empty successful mints say **No available funds**.
   Partial/interrupted results stay amber and errors red.
5. Capture the Metro lines beginning `[Recovery timing]` and `[Recovery queue timing]`.
   They contain aggregate counts/durations and no seed, mint URL, or proof material. Share
   those lines when diagnosing why a run is slow. Development timings are not release timings.
   The latest line should show `cached-recovery-v5`. If signature verification is slow, compare
   `keyPrecomputeMs`, `dleqVerificationMs` and `signatureUnblindMs`; these are submetrics of
   `unblindMs`, not extra time to add to it.
   Check `seedPreparationMs`, `signatureYieldMs`, `batchYieldMs` and `unaccountedMs` for
   time previously outside the recorded phases. Compare recovered balances, not just duration.
   Check that the spinner disappears after completion/failure and the UI remains responsive. Compare
   `signatureYieldMs` on runs with matching mint, keysets, batch and signature counts.
6. Repeat recovery. The balance must not double, and already claimed/spent ecash must not
   reappear as spendable. In-flight payments must retain their reservations.
7. Send a NEW message/payment offer from another wallet. It should arrive normally while
   online and unlocked, including NIP-17 gift-wrapped messages. The receiving and mint-trust
   approval rules must still apply. Wait until fund recovery finishes before checking delivery.
8. Restart Bey. The post-restore history cutoff must remain in effect. Then enable **Load
   older activity** explicitly: available messages/payment activity from the last seven days
   may appear. Older payment offers follow the existing approval rules. Disable it again:
   already loaded items remain, but no further pre-restore catch-up should be imported.
9. Repeat with an unavailable mint or interrupted connection. Expect an error/partial result
   with completed batches retained. Reconnect and retry; balances must remain consistent.
10. Review the same screen in light/dark mode and with large system text. Confirm row labels,
    checkbox touch targets, spinner and actions remain readable. Test Android back during
    recovery. From both Settings and seed import, idle Close/Android Back/Done/Go to Wallet
    must dismiss downward to Home; authentication and an active scan must block dismissal.
    Cold-start the dev client and tap Settings: the Settings home must open, not BUI.
    Test an old Settings recovery link, including a selected mint. With TalkBack,
    check selected/disabled checkbox states and text status labels. Home must not show recovery
    or recovery-review cards. Recovery remains available through Settings → Backup & recovery.

History loading concerns relay messages and payment activity, not existing local transaction
records or deterministic funds recovered from a mint. Relay retention can limit the available
history. No historical data is deleted by the switch.
