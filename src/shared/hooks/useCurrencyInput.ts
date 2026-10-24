import { useEffect, useRef, useState } from 'react';
import { currencyService } from '~/services/wallet/currencyService';
import { getCurrencyDisplayMode } from '~/shared/utils/currencyDisplay';

/** Keep the canonical sats amount intact when switching None on or off. */
export function useCurrencyInput(
  primary: 'SATS' | 'FIAT',
  currency: string,
  amount: string,
  price?: number,
) {
  const { fiatEnabled, primaryCurrency } = getCurrencyDisplayMode(primary, currency);
  const [selectedMode, setInputMode] = useState(primaryCurrency);
  const [draft, setLocalInputValue] = useState(amount);
  const wasFiatEnabled = useRef(fiatEnabled);
  useEffect(() => {
    if (!fiatEnabled) {
      setInputMode('SATS');
      setLocalInputValue(amount);
      wasFiatEnabled.current = false;
    } else if (!wasFiatEnabled.current) {
      if (primary === 'FIAT' && (!price || !Number.isFinite(price) || price <= 0)) return;
      setInputMode(primary);
      setLocalInputValue(
        primary === 'FIAT'
          ? currencyService.convertSatsToCurrency(Number(amount) || 0, price!).toFixed(2)
          : amount,
      );
      wasFiatEnabled.current = true;
    }
  }, [fiatEnabled, primary, price, amount]);
  return {
    fiatEnabled,
    inputMode: fiatEnabled ? selectedMode : ('SATS' as const),
    localInputValue: fiatEnabled ? draft : amount,
    setInputMode,
    setLocalInputValue,
  };
}
