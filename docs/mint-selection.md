# Trusted mint selection

Mint management has one implementation in `src/features/mints/MintsScreen.tsx`.
Home and Settings open `/(modals)/mints`; each row opens that mint's details. The
manager shows balances and connection status for every connected mint, including
untrusted mints that still hold funds, and respects hidden-balance preferences.
Its single Add mint action opens the discovery, URL-entry and scan flow. Adding
uses the shared trust sheet and stays in the add flow with an Added marker. A scan
opens trust review directly. Tapping a directory row still permits inspection.

The old Settings mints route uses the same manager implementation, and the old
discover route uses the same Add mint implementation; neither has a separate UI.
Funded trusted mint details provide Transfer funds, which passes that mint as the
source to the existing Transfer flow without changing the wallet's active selection.
Recovery remains a secondary action and technical features stay collapsed.

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

Transfer reconciliation checks the original source operation and destination quote together.
Completion requires the original destination quote and its saved issuance receipt to be issued,
matching mint URL, quote ID, amount and unit. A stale source operation cannot override this
destination credit. This follows [Cashu.me Android's transfer service](https://github.com/cashubtc/wallet/blob/main/android/app/src/main/java/com/cashu/me/Core/Wallet/WalletMintTransferService.kt)
and [History projection](https://github.com/cashubtc/wallet/blob/main/android/app/src/main/java/com/cashu/me/Core/MintTransferProjection.kt).
Earlier failed journals can be repaired, and History projects a matching issued receipt as
successful while keeping the original row ID. A paid invoice without saved issuance stays
pending; conflicting evidence never offers another payment. A paid/issued destination also
prevents a pending source from being rolled back on a contradictory unpaid response. Coco
retains ownership of proof handling and destination issuance; checks never submit a replacement
melt.

Device checks: repeat a transfer between Testnut and Sortug with a delayed response, reopen its
History receipt, and verify one debit, one credit and one aggregate outcome. This source-level fix
has not been reproduced against an attached device or the user's original quote records.

Device checks: create a wallet with several mints, change the current selection,
restart, remove or untrust the selection, and repeat with no trusted mints. Check
Lightning/ecash receive and send, Transfer and NFC selection, including cancellation
and an in-flight operation. Confirm light/dark Settings no longer shows a fallback
preference.
