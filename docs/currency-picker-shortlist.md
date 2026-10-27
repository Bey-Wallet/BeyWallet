# Currency picker decisions and European suggestions

## Implemented

Show all 25 current currencies by default, plus None for sats-only display. There is
no shortlist, hidden group or More currencies step.

Removed from the picker at the user's request:

- VND — Vietnamese Dong.
- PHP — Philippine Peso.
- IDR — Indonesian Rupiah.
- ARS — Argentine Peso.

PLN (Polish Zloty, `zł`, `pl-PL`) and CZK (Czech Koruna, `Kč`, `cs-CZ`) have been added.
Both use localized decimal commas and trailing currency symbols. Public CoinPaprika
and Coinbase BTC quote endpoints returned valid positive quotes for both codes during
verification on 27 October 2026. Quotes remain estimates fetched through the existing
provider/fallback path.

NGN (Nigerian Naira) and THB (Thai Baht) remain selectable. The naira symbol uses
Inter's original U+20A6 glyph; its shape has not been customized. The only added cmap
alias in the prepared Inter assets is full-width yen to Inter's existing yen glyph.

`SELECTABLE_CURRENCIES` controls the Settings choices. The full currency metadata is
retained in `SUPPORTED_CURRENCIES` so saved preferences and imported backups using
the removed codes continue to show their correct symbols and conversions. Selecting
a new currency offers only the current 25; existing preferences are not silently
changed to USD.

## Further European additions — deferred

The picker includes EUR, GBP, CHF, SEK, PLN and CZK, as well as TRY and RUB.

PLN and CZK were the two approved additions. Other non-euro options to consider later:

1. NOK — Norwegian Krone: Norwegian coverage beyond the existing SEK option.
2. DKK — Danish Krone: Danish coverage beyond the existing SEK option.

These are product recommendations, not measured Bey usage or Bitcoin-specific adoption
rankings. The [2025 European crypto analysis](https://www.chainalysis.com/blog/europe-crypto-adoption-2025/)
measures broader cryptocurrency activity. The [2026 global adoption index](https://www.chainalysis.com/blog/2026-global-crypto-adoption-index/)
also spans crypto assets and uses a different methodology; it does not establish which
fiat currencies Bey's users need.

NOK and DKK have not been added. Before adding them, verify quote
provider support, localized formatting, symbol disambiguation and font coverage.
