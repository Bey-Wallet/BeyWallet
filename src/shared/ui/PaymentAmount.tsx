import React from 'react';
import { amountLabel } from './amountLabel';
import { Text, YStack } from 'tamagui';
import { useQuery } from '@tanstack/react-query';
import { useSettingsStore } from '~/state/settingsStore';
import { bitcoinService } from '~/services/api/bitcoinService';
import { currencyService, type CurrencyCode } from '~/services/wallet/currencyService';

export function paymentAmounts(
  sats: number,
  primary: 'SATS' | 'FIAT',
  currency: string,
  bitcoinSymbol: boolean,
  price?: number,
) {
  const bitcoin = bitcoinSymbol
    ? `₿${sats.toLocaleString('en-US')}`
    : `${sats.toLocaleString('en-US')} sat`;
  const fiat =
    price && Number.isFinite(price) && price > 0
      ? currencyService.formatValue(
          currencyService.convertSatsToCurrency(sats, price),
          currency as CurrencyCode,
        )
      : null;
  return primary === 'FIAT'
    ? { primary: fiat, secondary: bitcoin }
    : { primary: bitcoin, secondary: fiat };
}

export function PaymentAmount({
  amount,
  label,
  compact = false,
}: {
  amount: number;
  label?: string;
  compact?: boolean;
}) {
  const { primaryCurrency, secondaryCurrency, showBitcoinSymbol } = useSettingsStore();
  const { data } = useQuery({
    queryKey: ['bitcoinPrice', secondaryCurrency],
    queryFn: () => bitcoinService.fetchPrice(secondaryCurrency),
    staleTime: 30000,
  });
  const values = paymentAmounts(
    amount,
    primaryCurrency,
    secondaryCurrency,
    showBitcoinSymbol,
    data?.price,
  );
  return (
    <YStack
      gap={compact ? '$2' : '$3'}
      py={compact ? 0 : '$7'}
      items="center"
      justify="center"
      width="100%"
    >
      {label && (
        <Text fontSize={14} fontWeight="500" color="$gray10" textAlign="center">
          {label}
        </Text>
      )}
      <Text
        fontSize={44}
        lineHeight={compact ? 56 : 64}
        letterSpacing={-1.5}
        fontWeight="500"
        color="$color"
        textAlign="center"
        maxWidth="100%"
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {amountLabel(values.primary ?? '—', 44)}
      </Text>
      <Text fontSize={16} color="$gray10" textAlign="center">
        {amountLabel(values.secondary ? `≈ ${values.secondary}` : 'Conversion unavailable', 16)}
      </Text>
    </YStack>
  );
}
