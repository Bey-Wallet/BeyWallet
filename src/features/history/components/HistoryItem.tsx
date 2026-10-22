import React, { useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { Text, XStack, YStack } from 'tamagui';
import {
  ArrowUpRight,
  ArrowDownLeft,
  ArrowRightLeft,
  ReceiptText,
  RefreshCw,
} from '@tamagui/lucide-icons';
import * as Haptics from 'expo-haptics';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToastController } from '@tamagui/toast';
import { useSettingsStore } from '~/state/settingsStore';
import { currencyService, type CurrencyCode } from '~/services/wallet/currencyService';
import { bitcoinService } from '~/services/api/bitcoinService';
import { AppPressable } from '~/shared/ui/AppPressable';
import { Spinner } from '~/shared/ui/Spinner';
import { formatHistoryWhen } from '~/shared/utils/time';
import { appTypography } from '~/shared/theme/appearance';
import { checkHistoryStatus } from '../checkHistoryStatus';
import {
  historyRail,
  historyTimestamp,
  isPendingHistory,
  type HistoryListEntry,
} from '../historyList';

export interface HistoryItemProps {
  entry: HistoryListEntry;
  displayAmount: number;
  onPress: (id: string, type: string) => void;
  position: 'first' | 'middle' | 'last' | 'only';
}

export const HistoryItem = React.memo<HistoryItemProps>(function HistoryItem({
  entry,
  displayAmount: amount,
  onPress,
  position,
}) {
  const { primaryCurrency, secondaryCurrency } = useSettingsStore();
  const toast = useToastController();
  const queryClient = useQueryClient();
  const checking = useRef(false);
  const [isChecking, setIsChecking] = useState(false);
  const { data: btcData } = useQuery({
    queryKey: ['bitcoinPrice', secondaryCurrency],
    queryFn: () => bitcoinService.fetchPrice(secondaryCurrency),
    staleTime: 30000,
    enabled: primaryCurrency !== 'SATS' && secondaryCurrency !== 'NONE',
  });
  const value =
    primaryCurrency === 'SATS' || !btcData?.price
      ? currencyService.formatSats(amount)
      : currencyService.formatValue(
          currencyService.convertSatsToCurrency(amount, btcData.price),
          secondaryCurrency as CurrencyCode,
        );
  const outgoing = ['send', 'melt'].includes(entry.type);
  const rail = historyRail(entry);
  const transfer = rail === 'transfer';
  const request = entry.type === 'receive-request';
  const pending = isPendingHistory(entry);
  const state = entry.state?.toLowerCase() || '';
  const failed = [
    'failed',
    'error',
    'expired',
    'cancelled',
    'canceled',
    'rolled_back',
    'rolledback',
  ].includes(state);
  const label = transfer
    ? 'Transfer'
    : request
      ? 'Payment request'
      : `${outgoing ? 'Sent' : 'Received'} ${rail === 'onchain' ? 'bitcoin' : rail === 'lightning' ? 'Lightning' : 'ecash'}`;
  const Icon = transfer
    ? ArrowRightLeft
    : request
      ? ReceiptText
      : outgoing
        ? ArrowUpRight
        : ArrowDownLeft;
  const statusLabel = pending
    ? 'Pending'
    : state === 'refunded'
      ? 'Refunded'
      : failed
        ? state === 'expired'
          ? 'Expired'
          : state === 'cancelled' || state === 'canceled'
            ? 'Cancelled'
            : 'Failed'
        : '';
  const title = transfer
    ? 'Transfer'
    : request
      ? 'Payment request'
      : outgoing
        ? 'Sent'
        : 'Received';
  const paymentType = transfer
    ? 'Between mints'
    : rail === 'onchain'
      ? 'Bitcoin'
      : rail === 'lightning'
        ? 'Lightning'
        : 'Ecash';
  const subtitle = [paymentType, statusLabel].filter(Boolean).join(' · ');
  const when = formatHistoryWhen(historyTimestamp(entry.createdAt));

  const handleCheck = async () => {
    if (checking.current) return;
    checking.current = true;
    setIsChecking(true);
    Haptics.selectionAsync();
    try {
      const message = await checkHistoryStatus(entry);
      await queryClient.invalidateQueries({ queryKey: ['history'] });
      await queryClient.invalidateQueries({ queryKey: ['transaction', entry.id] });
      toast.show(message, { kind: 'info' });
    } catch {
      toast.show('Could not verify status. Please try again.', { kind: 'error' });
    } finally {
      checking.current = false;
      setIsChecking(false);
    }
  };

  return (
    <YStack>
      <XStack items="center" minHeight={60}>
        <AppPressable
          flex={1}
          minWidth={0}
          minHeight={60}
          px={0}
          py={10}
          flexDirection="row"
          items="center"
          gap={12}
          bg="transparent"
          hoverStyle={{ bg: 'transparent', opacity: 0.85 }}
          pressStyle={{ bg: 'transparent', opacity: 0.6 }}
          accessibilityLabel={`${label}, ${value}${statusLabel ? `, ${statusLabel}` : ''}. Open details`}
          onPress={() => {
            Haptics.selectionAsync();
            onPress(entry.id, entry.type);
          }}
        >
          <XStack width={36} height={36} rounded={100} bg="$gray2" items="center" justify="center">
            <Icon size={20} strokeWidth={2.5} color="$iconPrimary" />
          </XStack>
          <YStack flex={1} minWidth={0} gap={2}>
            <Text {...appTypography.label2} color="$color" numberOfLines={1}>
              {title}
            </Text>
            <Text {...appTypography.body3} color={failed ? '$red10' : '$gray10'} numberOfLines={1}>
              {subtitle}
            </Text>
          </YStack>
          <YStack items="flex-end" flexShrink={1} maxWidth="45%" gap={2}>
            <Text
              {...appTypography.label2}
              fontWeight="600"
              color="$color"
              numberOfLines={1}
              style={{ fontVariant: ['tabular-nums'] }}
            >
              {transfer || request ? '' : outgoing ? '−' : '+'}
              {value}
            </Text>
            <Text {...appTypography.body3} color="$gray10" numberOfLines={1}>
              {when}
            </Text>
          </YStack>
        </AppPressable>
        {pending && (
          <AppPressable
            minHeight={48}
            width={48}
            items="center"
            justify="center"
            accessibilityLabel={`Check status of ${label.toLowerCase()}`}
            accessibilityState={{ busy: isChecking }}
            disabled={isChecking}
            bg="transparent"
            hoverStyle={{ bg: 'transparent', opacity: 0.85 }}
            pressStyle={{ bg: 'transparent', opacity: 0.6 }}
            onPress={handleCheck}
          >
            <XStack
              width={30}
              height={30}
              rounded={100}
              bg="$gray2"
              items="center"
              justify="center"
            >
              {isChecking ? (
                <Spinner size={15} color="$iconPrimary" />
              ) : (
                <RefreshCw size={15} color="$iconPrimary" />
              )}
            </XStack>
          </AppPressable>
        )}
      </XStack>
      {(position === 'first' || position === 'middle') && (
        <YStack height={StyleSheet.hairlineWidth} bg="$separatorAlternate" />
      )}
    </YStack>
  );
});
