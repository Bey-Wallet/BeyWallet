import React from 'react';
import { Text, XStack, YStack } from 'tamagui';
import { ArrowUp, ArrowDown, ArrowRightLeft, HandCoins, CircleHelp } from '@tamagui/lucide-icons';
import { useQuery } from '@tanstack/react-query';
import { useSettingsStore } from '~/state/settingsStore';
import { currencyService, type CurrencyCode } from '~/services/wallet/currencyService';
import { bitcoinService } from '~/services/api/bitcoinService';
import { AppPressable } from '~/shared/ui/AppPressable';
import {
  historyRowPresentation,
  historyRowTime,
  isHistoryPending,
  type HistoryListEntry,
} from '../historyListModel';
import { historyDisplayAmount } from '../transactionPresentation';
import { useHistoryColors } from '../historyTheme';

export interface HistoryItemProps {
  entry: HistoryListEntry;
  onPress: (id: string, type: string) => void;
  now?: Date;
}
const icons = {
  sent: ArrowUp,
  received: ArrowDown,
  transfer: ArrowRightLeft,
  request: HandCoins,
  activity: CircleHelp,
};

export const HistoryItem = React.memo(function HistoryItem({
  entry,
  onPress,
  now,
}: HistoryItemProps) {
  const colors = useHistoryColors();
  const { primaryCurrency, secondaryCurrency } = useSettingsStore();
  const { data: price, isFetching } = useQuery({
    queryKey: ['bitcoinPrice', secondaryCurrency],
    queryFn: () => bitcoinService.fetchPrice(secondaryCurrency),
    staleTime: 30000,
    enabled: primaryCurrency !== 'SATS' && secondaryCurrency !== 'NONE',
  });
  const amount = historyDisplayAmount(entry);
  const formatted =
    primaryCurrency === 'SATS' || secondaryCurrency === 'NONE'
      ? currencyService.formatSats(amount)
      : price?.price
        ? currencyService.formatValue(
            currencyService.convertSatsToCurrency(amount, price.price),
            secondaryCurrency as CurrencyCode,
          )
        : isFetching
          ? 'Loading…'
          : currencyService.formatSats(amount);
  const { title, subtitle, sign, icon } = historyRowPresentation(entry);
  const Icon = icons[icon];
  const state = (entry.state || '').trim().toLowerCase();
  const pending = isHistoryPending(state);
  const failed = ['failed', 'error', 'cancelled', 'canceled'].includes(state);
  const status = pending
    ? 'Pending'
    : state === 'expired'
      ? 'Expired'
      : state === 'refunded'
        ? 'Refunded'
        : failed
          ? 'Failed'
          : '';
  const statusColor = pending ? colors.secondary : state === 'refunded' ? '$blue10' : '$red10';
  const time = historyRowTime(entry.createdAt, now);

  return (
    <YStack bg={colors.card} overflow="hidden" rounded="$6" mb={8}>
      <AppPressable
        minHeight={80}
        px={16}
        py={16}
        flexDirection="row"
        items="center"
        gap={16}
        accessibilityRole="button"
        accessibilityLabel={`${title}, ${subtitle}, ${sign}${formatted}, ${time}${status ? `, ${status}` : ''}`}
        hoverStyle={{ bg: colors.hover }}
        pressStyle={{ bg: colors.press }}
        onPress={() => onPress(entry.id, entry.type)}
      >
        <XStack
          width={44}
          height={44}
          rounded={100}
          bg={colors.circle}
          items="center"
          justify="center"
          aria-hidden
        >
          <Icon size={22} color={colors.icon} strokeWidth={2.4} />
        </XStack>
        <YStack flex={1} minWidth={0} gap={3}>
          <Text
            fontFamily="$body"
            fontSize={18}
            lineHeight={24}
            fontWeight="500"
            color={colors.primary}
            numberOfLines={1}
          >
            {title}
          </Text>
          <Text
            fontFamily="$body"
            fontSize={15}
            lineHeight={21}
            fontWeight="400"
            color={colors.secondary}
            numberOfLines={1}
          >
            {subtitle}
            {status ? ' · ' : ''}
            {status ? (
              <Text
                fontFamily="$body"
                fontSize={15}
                lineHeight={21}
                fontWeight="400"
                color={statusColor}
              >
                {status}
              </Text>
            ) : null}
          </Text>
        </YStack>
        <YStack maxWidth="48%" items="flex-end" gap={3} flexShrink={1}>
          <Text
            fontFamily="$body"
            fontSize={18}
            lineHeight={24}
            fontWeight="500"
            color={colors.primary}
            text="right"
            fontVariant={['tabular-nums']}
          >
            {sign ? `${sign} ` : ''}
            {formatted}
          </Text>
          <Text
            fontFamily="$body"
            fontSize={15}
            lineHeight={21}
            fontWeight="400"
            color={colors.secondary}
            text="right"
          >
            {time}
          </Text>
        </YStack>
      </AppPressable>
    </YStack>
  );
});
