# Conditional sats-only interface

Settings → Fiat currency → None enables sats-only display and entry. All amounts
remain sats internally. None overrides the saved primary display preference without
rewriting it, and retains the Bitcoin symbol preference and hidden-balance behavior.
Selecting a fiat currency restores the usual display and amount-entry behavior.

## Implementation coverage

- Shared payment amounts omit the entire secondary row, including loading/error
  captions. Home balance height is 160 instead of 200; confirmation/receipt hero
  minimum heights are 208/248 instead of 240/280. QR surfaces stay unchanged.
- Home, mint lists/pickers/details, History, People and Nostr payment surfaces use
  one sats amount for None. Existing conditional displays are retained; custom
  mint detail, Nostr detail/list and token detail views are covered as well.
- Standard/P2PK/Nostr send, Transfer, Lightning top-up/payment, on-chain payment,
  and request amount entry suppress conversion controls and decimal keys for None.
  Open editors switch using canonical sats, without reinterpreting a fiat draft.
- Price observers are disabled for None, including unused display conversions in
  payment containers. Currency services, caches, backup fields, routes and stored
  preferences remain compatible. No database migration is required.

## Automated validation

```sh
yarn test:ci --silent --runInBand --runTestsByPath tests/unit/payment-amount.test.tsx tests/unit/currency-input-mode.test.tsx tests/unit/request-amount-editor.test.tsx tests/unit/home-balance-cache.test.tsx tests/unit/payment-stage-layout.test.tsx tests/unit/mint-selector-sheet.test.tsx tests/unit/lightning-invoice-entry.test.tsx
yarn typecheck
yarn test:ci --silent --runInBand
yarn check:structure
yarn check:buttons
```

Check formatting only for changed files. Tests cover None with either saved primary,
both symbols, hidden balances, exact editor amounts, a currency re-enabled without a
rate, keypad validation, Max, online quote suppression and existing fiat behavior.

## Device review still required

Use a disposable test wallet. Record screenshots only when they do not contain
tokens, QR payloads, keys or other sensitive data.

- Test None, USD and another supported currency with both primary-unit preferences
  and both Bitcoin-symbol settings. Restore a backup containing None and repeat.
- Review Home, connected mints, mint selection/details, History rows/details,
  People payment previews/conversations/detail sheets, Nostr activity and claims.
- Exercise standard, locked and Nostr ecash sends, Transfer, requests, Lightning
  top-up/payment and on-chain deposit/payment through input, confirmation, pending
  and result states. Confirm None shows no secondary amount, placeholder or switch.
- Open an amount editor, change the fiat preference to None and back, and confirm
  the exact sats amount, Max/presets, fees and balance validation remain correct.
- Test None offline and with failing price providers. Amount display and entry
  must not depend on a quote. Re-enable a currency and verify conversion recovers.
- Check light/dark themes, narrow screens and large accessibility text. Preserve
  48-point targets, amount sizing, QR quiet zones, scrolling and reachable footers.
- Verify real payments and NFC on device; authentication, proof checks, unit
  conversions at protocol boundaries and claim/reclaim guards are unchanged.
