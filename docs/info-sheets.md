# Information sheets

Read-only explanations live in `src/shared/components/info-sheets/`. `InfoSheet` renders the
static content in `infoSheetContent.ts` through the existing BUI sheet. `TransferInfoSheet`
retains the dedicated Transfer component API.
Info sheets use the compact modal header style with short topic titles; longer explanations
belong in the scrollable body. Other sheet header styles are unchanged.
Triggers use the standard circled Info glyph at 22 points on a transparent ghost button with
a 48-point touch target.

Payment entry and confirmation screens opt in through `PaymentInfoHeader`. The trigger uses
the existing accessible header icon button. An existing `headerRight` callback reserves the slot,
even if it returns null. A receipt sheet that owns the header also reserves it. Info actions are
cleared when their stage unmounts so pending and result screens cannot inherit a stale trigger.

Topics cover ecash sending/receiving, Nostr delivery, Lightning payments/top-ups/requests,
on-chain payments/deposits, and optimization. Transfer retains its existing information action.

Settings uses the explicit `settingsInfoTopics` allowlist in `SettingsStack`: offline change,
optimization, Lightning address and receiving mint, receiving policy, proofs,
offline proof verification, mint-list backup, backup export/restore, recovery, and relays.
Screen-specific header options take precedence over the navigator default. The sheet closes
when its Settings destination loses focus.

Pending receipts, Scanner, conversations, Add Mint, and mint details keep their existing header
actions. Simple preferences and sensitive phrase/key/deletion screens receive no Info trigger.
Essential security warnings stay inline. Reading an explanation performs no wallet operation,
authentication, or preference write; existing operation guards remain in place.

Device review should cover both themes, large text, sheet scrolling/dismissal, Android Back,
and moving from an entry screen to a pending or completed payment without a stale Info button.
