# Trusted mint selection

The wallet has a set of connected mints with independent trust decisions. There is
no separate default or fallback mint preference. Only trusted mints are offered by
the payment mint selector unless a caller explicitly requests otherwise.

The active mint is the current selection, following the connected-list and active
selection model in [Cashu.me's mint store](https://github.com/cashubtc/cashu.me/blob/main/src/stores/mints.ts).
Startup preserves that selection if it is still trusted. Otherwise it selects the
first trusted mint, or clears the selection when none are trusted. Removing or
untrusting the selected mint applies the same rule. Selection never adds a mint or
changes its trust status. Balances at untrusted mints remain available for inspection.

Onboarding connects only the mints explicitly acknowledged by the user. Backups
continue to preserve mint records, trust flags, proofs and operation journals.
Older backup mint preferences and saved database preferences are ignored; they
cannot reconnect or re-trust a mint. New exports omit the retired preference.

The historical featured mint remains a seed-recovery suggestion when no mint-list
backup is available. It must pass through recovery review and is never implicitly
trusted by discovery. Key derivation and recovery scanning are unchanged.

Device checks: create a wallet with several mints, change the current selection,
restart, remove or untrust the selection, and repeat with no trusted mints. Check
Lightning/ecash receive and send, Transfer and NFC selection, including cancellation
and an in-flight operation. Confirm light/dark Settings no longer shows a fallback
preference.
