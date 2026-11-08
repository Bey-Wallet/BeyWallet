/** None overrides the saved primary preference without changing it. */
export function getCurrencyDisplayMode(primaryCurrency: 'SATS' | 'FIAT', currency: string) {
  const fiatEnabled = currency !== 'NONE';
  return { fiatEnabled, primaryCurrency: fiatEnabled ? primaryCurrency : ('SATS' as const) };
}

/** Keep prefix symbols attached to the amount without altering suffixes or grouping. */
export function compactCurrencyPrefix(value: string): string {
  return value.replace(/^([+\-−<>=\s]*)([\p{Sc}\p{L}]+)\s*(?=[+\-−]?\d)/u, '$1$2');
}
