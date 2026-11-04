/** None overrides the saved primary preference without changing it. */
export function getCurrencyDisplayMode(primaryCurrency: 'SATS' | 'FIAT', currency: string) {
  const fiatEnabled = currency !== 'NONE';
  return { fiatEnabled, primaryCurrency: fiatEnabled ? primaryCurrency : ('SATS' as const) };
}

/** A narrow non-breaking gap keeps currency prefixes close to their amount. */
export function spaceCurrencyPrefix(value: string): string {
  return value.replace(/^([+\-−<>=\s]*)([\p{Sc}\p{L}]+)\s*(?=[+\-−]?\d)/u, '$1$2\u202f');
}
