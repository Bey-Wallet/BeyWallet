# Currency picker decisions and European suggestions

## Implemented

Show all 25 current currencies by default, plus None for sats-only display. There is
no shortlist, hidden group or More currencies step.
The list keeps its configured order when selecting a currency; only the checkmark moves.
The order follows descending OTC FX turnover in the September release of the
[2025 BIS survey, Table 4](https://www.bis.org/publications/202509-commentary-otc-derivatives.pdf).
KWD and NGN are not individually ranked in that table and follow alphabetically.
None remains first as the sats-only option.

Removed from the picker and metadata at the user's request:

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
Inter's original U+20A6 glyph; its shape has not been customized. No currency glyphs or cmap aliases are customized; full-width yen may use platform fallback.

`SELECTABLE_CURRENCIES` and `SUPPORTED_CURRENCIES` now expose the same 25 currencies.
There is no hidden currency metadata. Unrecognized saved codes use a generic numeric
display with the original code as a suffix, rather than silently displaying USD.

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
