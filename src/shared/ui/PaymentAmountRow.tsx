import React from 'react';
import { Text } from 'tamagui';
import { useQuery } from '@tanstack/react-query';
import { useSettingsStore } from '~/state/settingsStore';
import { bitcoinService } from '~/services/api/bitcoinService';
import { appTypography } from '~/shared/theme/appearance';
import { paymentAmounts } from './PaymentAmount';
import { ListTableRow } from './ListTable';

/** Compact QR-screen amount, using the same currency ordering as payment heroes. */
export function PaymentAmountRow({ amount }: { amount: number }) {
  const { primaryCurrency, secondaryCurrency, showBitcoinSymbol } = useSettingsStore();
  const { data } = useQuery({
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
  const primary = values.primary ?? values.secondary ?? '';
  const secondary =
    values.primary === null || secondaryCurrency === 'NONE' ? null : values.secondary;
  return (
    <ListTableRow
      label="Amount"
      multiline
      expandValue
      value={
        <Text
          fontFamily="$body"
          {...appTypography.label1}
          color="$color"
          textAlign="right"
          flexShrink={1}
        >
          {primary}
          {secondary && <Text {...appTypography.body2} color="$gray10">{` (${secondary})`}</Text>}
        </Text>
      }
    />
  );
}
