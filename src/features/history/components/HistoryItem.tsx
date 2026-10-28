import { interactionCopy } from '~/services/feedback/interactionCopy';
import { formatRelativeTime } from '~/shared/utils/time';
import React, { useRef, useState } from 'react';
import { Text, XStack, YStack } from 'tamagui';
import {
  ArrowUpFromLine,
  ArrowDownToLine,
  ArrowRightLeft,
  ReceiptText,
  RefreshCw,
} from '@tamagui/lucide-icons';
import * as Haptics from 'expo-haptics';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppToast } from '~/shared/hooks/useAppToast';
import { useSettingsStore } from '~/state/settingsStore';
import { currencyService, type CurrencyCode } from '~/services/wallet/currencyService';
import { bitcoinService } from '~/services/api/bitcoinService';
import { AppPressable } from '~/shared/ui/AppPressable';
import { Spinner } from '~/shared/ui/Spinner';
import { appTypography } from '~/shared/theme/appearance';
import { useNostrRequestStore } from '~/state/nostrRequestStore';
import { historyStatusLabel } from '../transactionPresentation';
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
  const toast = useAppToast();
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
    primaryCurrency === 'SATS' || secondaryCurrency === 'NONE' || !btcData?.price
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
  const delivered = useNostrRequestStore(
    (store) =>
      !!entry.operationId &&
      !!store.payments?.some(
        (payment) => payment.operationId === entry.operationId && payment.published,
      ),
  );
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
  const statusLabel =
    pending || failed || state === 'refunded' ? historyStatusLabel(entry, delivered) : '';
  const label = transfer
    ? 'Transfer'
    : request
      ? 'Payment request'
      : entry.type === 'send' && pending
        ? `${statusLabel === 'Delivered' ? 'Delivered' : 'Created'} ecash`
        : `${outgoing ? 'Sent' : 'Received'} ${rail === 'onchain' ? 'bitcoin' : rail === 'lightning' ? 'Lightning' : 'ecash'}`;
  const Icon = transfer
    ? ArrowRightLeft
    : request
      ? ReceiptText
      : outgoing
        ? ArrowUpFromLine
        : ArrowDownToLine;
  const title = transfer
    ? 'Transfer'
    : request
      ? 'Payment request'
      : entry.type === 'send' && pending
        ? statusLabel === 'Delivered'
          ? 'Ecash delivered'
          : 'Ecash created'
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
  const when = formatRelativeTime(historyTimestamp(entry.createdAt));

  const handleCheck = async () => {
    if (checking.current) return;
    checking.current = true;
    setIsChecking(true);
    Haptics.selectionAsync();
    try {
      const message = await checkHistoryStatus(entry);
      await queryClient.invalidateQueries({ queryKey: ['history'] });
      await queryClient.invalidateQueries({ queryKey: ['transaction', entry.id] });
      toast.show(message, {
        kind: 'info',
        duration: 6000,
        customData: {
          kind: 'info',
          variant: 'action',
          actionLabel: 'View',
          onAction: () => onPress(entry.id, entry.type),
        },
      });
    } catch {
      toast.showFeedback(interactionCopy.couldNotVerifyStatusPleaseTryAgain);
    } finally {
      checking.current = false;
      setIsChecking(false);
    }
  };

  return (
    <YStack
      bg="transparent"
      rounded="$6"
      overflow="hidden"
      mb={position === 'first' || position === 'middle' ? 6 : 0}
    >
      <XStack items="center" minHeight={64}>
        <AppPressable
          flex={1}
          minWidth={0}
          minHeight={64}
          pl={0}
          pr={0}
          py={8}
          flexDirection="row"
          items="center"
          gap={12}
          bg="transparent"
          hoverStyle={{ opacity: 0.9 }}
          pressStyle={{ opacity: 0.8 }}
          accessibilityLabel={`${label}, ${value}${statusLabel ? `, ${statusLabel}` : ''}. Open details`}
          onPress={() => {
            Haptics.selectionAsync();
            onPress(entry.id, entry.type);
          }}
        >
          <XStack width={44} height={44} rounded={100} bg="$gray3" items="center" justify="center">
            <Icon size={24} strokeWidth={2.5} color="$gray10" />
          </XStack>
          <YStack flex={1} minWidth={0} gap={2}>
            <XStack items="center" gap={4}>
              <Text {...appTypography.label1} color="$color" numberOfLines={1} flexShrink={1}>
                {title}
              </Text>
              {pending && (
                <AppPressable
                  minHeight={24}
                  minWidth={24}
                  flexShrink={0}
                  hitSlop={12}
                  items="center"
                  justify="center"
                  accessibilityLabel={`Check status of ${label.toLowerCase()}`}
                  accessibilityState={{ busy: isChecking }}
                  disabled={isChecking}
                  bg="transparent"
                  hoverStyle={{ bg: 'transparent', opacity: 0.85 }}
                  pressStyle={{ bg: 'transparent', opacity: 0.6 }}
                  onPress={(event) => {
                    event.stopPropagation();
                    void handleCheck();
                  }}
                >
                  {isChecking ? (
                    <Spinner size={20} color="$gray10" />
                  ) : (
                    <RefreshCw size={20} color="$gray10" />
                  )}
                </AppPressable>
              )}
            </XStack>
            <Text
              {...appTypography.body3}
              color={failed ? '$red10' : pending ? '$orange10' : '$gray10'}
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          </YStack>
          <YStack items="flex-end" flexShrink={1} maxWidth="45%" gap={2}>
            <Text
              {...appTypography.label1}
              fontWeight="600"
              color="$color"
              numberOfLines={1}
              style={{ fontVariant: ['tabular-nums'] }}
            >
              {transfer || request ? '' : outgoing ? '− ' : '+ '}
              {value}
            </Text>
            <Text {...appTypography.body3} color="$gray10" numberOfLines={1} textAlign="right">
              {when}
            </Text>
          </YStack>
        </AppPressable>
      </XStack>
    </YStack>
  );
});
