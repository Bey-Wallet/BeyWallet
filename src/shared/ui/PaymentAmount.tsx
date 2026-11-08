import React from 'react';
import { amountLabel } from './amountLabel';
import { Text, YStack } from 'tamagui';
import { useQuery } from '@tanstack/react-query';
import { useSettingsStore } from '~/state/settingsStore';
import { bitcoinService } from '~/services/api/bitcoinService';
import { currencyService, type CurrencyCode } from '~/services/wallet/currencyService';
import { appTypography } from '~/shared/theme/appearance';
import { getCurrencyDisplayMode } from '~/shared/utils/currencyDisplay';

export function paymentAmounts(
  sats: number,
  primary: 'SATS' | 'FIAT',
  currency: string,
  bitcoinSymbol: boolean,
  price?: number,
) {
  const display = getCurrencyDisplayMode(primary, currency);
  const bitcoin = bitcoinSymbol
    ? `₿${sats.toLocaleString('en-US')}`
    : `${sats.toLocaleString('en-US')} sat`;
  const fiat =
    currency !== 'NONE' && (sats === 0 || (price && Number.isFinite(price) && price > 0))
      ? currencyService.formatValue(
          sats === 0 ? 0 : currencyService.convertSatsToCurrency(sats, price!),
          currency as CurrencyCode,
        )
      : null;
  return display.primaryCurrency === 'FIAT'
    ? { primary: fiat, secondary: bitcoin }
    : { primary: bitcoin, secondary: fiat };
}

export function PaymentAmount({
  amount,
  label,
  compact = false,
  size = 'standard',
  testID,
}: {
  amount: number;
  label?: string;
  compact?: boolean;
  size?: 'standard' | 'prominent';
  testID?: string;
}) {
  const { primaryCurrency, secondaryCurrency, showBitcoinSymbol } = useSettingsStore();
  const { data, isFetching } = useQuery({
    queryKey: ['bitcoinPrice', secondaryCurrency],
    queryFn: () => bitcoinService.fetchPrice(secondaryCurrency),
    staleTime: 30000,
    enabled: secondaryCurrency !== 'NONE',
  });
  const values = paymentAmounts(
    amount,
    primaryCurrency,
    secondaryCurrency,
    showBitcoinSymbol,
    data?.price,
  );
  const amountStyle = size === 'prominent' ? appTypography.display : appTypography.amount;
  const conversionStyle = size === 'prominent' ? appTypography.body1 : appTypography.body2;
  return (
    <YStack
      gap={compact ? '$2' : '$3'}
      py={compact ? 0 : '$7'}
      items="center"
      justify="center"
      width="100%"
    >
      {label && (
        <Text {...appTypography.label2} color="$gray10" textAlign="center">
          {label}
        </Text>
      )}
      <Text
        testID={testID ? `${testID}-primary-amount` : undefined}
        {...amountStyle}
        color="$color"
        textAlign="center"
        maxWidth="100%"
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {amountLabel(
          values.primary ?? (isFetching ? 'Loading…' : 'Conversion unavailable'),
          amountStyle.fontSize,
        )}
      </Text>
      {secondaryCurrency !== 'NONE' && (
        <Text
          testID={testID ? `${testID}-secondary-amount` : undefined}
          {...conversionStyle}
          color="$gray10"
          textAlign="center"
        >
          {amountLabel(
            values.secondary
              ? `≈ ${values.secondary}`
              : isFetching
                ? 'Loading…'
                : 'Conversion unavailable',
            conversionStyle.fontSize,
          )}
        </Text>
      )}
    </YStack>
  );
}
