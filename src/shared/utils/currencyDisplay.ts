/** None overrides the saved primary preference without changing it. */
export function getCurrencyDisplayMode(primaryCurrency: 'SATS' | 'FIAT', currency: string) {
  const fiatEnabled = currency !== 'NONE';
  return { fiatEnabled, primaryCurrency: fiatEnabled ? primaryCurrency : ('SATS' as const) };
}
