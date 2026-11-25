import { interactionCopy } from '~/services/feedback/interactionCopy';
import { formatRelativeTime } from '~/shared/utils/time';
import React, { useRef, useState } from 'react';
import { Text, XStack, YStack } from 'tamagui';
import {
  ArrowDownLeft,
  ArrowDownLeftCircle,
  ArrowRightLeft,
  ArrowUpRight,
  ArrowUpRightCircle,
  Bitcoin,
  ReceiptText,
  RefreshCw,
  Coins,
  RotateCcw,
  Undo2,
  Zap,
} from '~/shared/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppToast } from '~/shared/hooks/useAppToast';
import { useSettingsStore } from '~/state/settingsStore';
import { currencyService, type CurrencyCode } from '~/services/wallet/currencyService';
import { bitcoinService } from '~/services/api/bitcoinService';
import { AppPressable } from '~/shared/ui/AppPressable';
import { Spinner } from '~/shared/ui/Spinner';
import { appTypography } from '~/shared/theme/appearance';
import { useNostrRequestStore } from '~/state/nostrRequestStore';
import {
  historyBalanceEffect,
  historyStatusLabel,
  historyMetadata,
} from '../transactionPresentation';
import { walletActivityTitle, walletActivityStatus } from '../walletActivityPresentation';
import type { WalletActivity } from '~/storage/sqlite/repositories/WalletActivityRepository';
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
  const checking = useRef(new Set<string>());
  const [checkingKeys, setCheckingKeys] = useState<ReadonlySet<string>>(() => new Set());
  const entryKey = `${entry.type}:${entry.id}`;
  const isChecking = checkingKeys.has(entryKey);
  const { data: btcData } = useQuery({
    queryKey: ['bitcoinPrice', secondaryCurrency],
    queryFn: () => bitcoinService.fetchPrice(secondaryCurrency),
    staleTime: 30000,
    enabled: primaryCurrency !== 'SATS' && secondaryCurrency !== 'NONE',
  });
  const maintenance = entry.type === 'maintenance';
  const activity = maintenance
    ? (historyMetadata(entry).walletActivity as WalletActivity)
    : undefined;
  const shownAmount = activity ? Math.abs(activity.balanceDelta ?? 0) : amount;
  const formattedValue =
    primaryCurrency === 'SATS' || secondaryCurrency === 'NONE' || !btcData?.price
      ? currencyService.formatSats(shownAmount)
      : currencyService.formatValue(
          currencyService.convertSatsToCurrency(shownAmount, btcData.price),
          secondaryCurrency as CurrencyCode,
        );
  const value = activity
    ? activity.balanceDelta == null
      ? '—'
      : activity.balanceDelta === 0
        ? 'No change'
        : `${activity.balanceDelta < 0 ? '− ' : '+ '}${formattedValue}`
    : formattedValue;
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
  const paymentFailed = ['failed', 'error', 'rolled_back', 'rolledback'].includes(state);
  const failed = paymentFailed || ['expired', 'cancelled', 'canceled'].includes(state);
  const balanceEffect = historyBalanceEffect(entry);
  const amountDimmed = maintenance
    ? false
    : transfer
      ? pending || failed
      : balanceEffect === 'none';
  const signedValue = `${maintenance || transfer ? '' : balanceEffect === 'credit' ? '+ ' : balanceEffect === 'debit' ? '− ' : ''}${value}`;
  const statusLabel =
    pending || failed || state === 'refunded' ? historyStatusLabel(entry, delivered) : '';
  const posTitle =
    historyMetadata(entry).pos === true
      ? `POS ${failed ? 'not completed' : pending ? 'pending' : request ? 'request' : 'received'} (${entry.type === 'mint' ? 'Lightning' : 'Ecash'})`
      : undefined;
  const label =
    posTitle ||
    (activity
      ? walletActivityTitle(activity)
      : transfer
        ? 'Transfer'
        : request
          ? 'Payment request'
          : entry.type === 'send' && pending
            ? `${statusLabel === 'Delivered' ? 'Delivered' : 'Created'} ecash`
            : `${outgoing ? 'Sent' : 'Received'} ${rail === 'onchain' ? 'bitcoin' : rail === 'lightning' ? 'Lightning' : 'ecash'}`);
  const Icon = activity
    ? activity.kind === 'recovery'
      ? RotateCcw
      : activity.kind === 'get-change'
        ? Coins
        : RefreshCw
    : transfer
      ? ArrowRightLeft
      : request
        ? ReceiptText
        : state === 'refunded'
          ? Undo2
          : rail === 'onchain'
            ? Bitcoin
            : rail === 'lightning'
              ? Zap
              : outgoing
                ? ArrowUpRightCircle
                : ArrowDownLeftCircle;
  const DirectionIcon =
    state !== 'refunded' && (rail === 'onchain' || rail === 'lightning')
      ? outgoing
        ? ArrowUpRight
        : ArrowDownLeft
      : null;
  const title =
    posTitle ||
    (activity
      ? walletActivityTitle(activity)
      : state === 'refunded'
        ? 'Funds reclaimed'
        : transfer
          ? 'Transfer'
          : request
            ? 'Payment request'
            : entry.type === 'send' && pending
              ? statusLabel === 'Delivered'
                ? 'Ecash delivered'
                : 'Ecash created'
              : outgoing
                ? 'Sent'
                : 'Received');
  const paymentType = transfer
    ? 'Between mints'
    : rail === 'onchain'
      ? 'Bitcoin'
      : rail === 'lightning'
        ? 'Lightning'
        : 'Ecash';
  const awaitingClaim = entry.type === 'send' && pending && !transfer;
  const subtitleStatus = activity
    ? walletActivityStatus(activity.state)
    : awaitingClaim
      ? 'Awaiting claim'
      : statusLabel;
  const subtitleContext = activity
    ? activity.kind === 'optimize' && activity.fee == null
      ? 'Fee unavailable'
      : 'Wallet maintenance'
    : awaitingClaim
      ? ''
      : paymentType;
  const statusColor = failed ? '$red10' : pending ? '$orange10' : '$gray10';
  const primaryColor = paymentFailed ? '$red10' : '$color';
  const when = formatRelativeTime(historyTimestamp(entry.createdAt));

  const handleCheck = async () => {
    if (checking.current.has(entryKey)) return;
    checking.current.add(entryKey);
    setCheckingKeys((current) => new Set(current).add(entryKey));

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
      checking.current.delete(entryKey);
      setCheckingKeys((current) => {
        const next = new Set(current);
        next.delete(entryKey);
        return next;
      });
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
          accessibilityLabel={`${label}, ${signedValue}, ${activity ? walletActivityStatus(activity.state) : statusLabel || paymentType}. Open details`}
          onPress={() => {
            onPress(entry.id, entry.type);
          }}
        >
          <XStack
            width={44}
            height={44}
            rounded={100}
            bg="$gray3"
            items="center"
            justify="center"
            position="relative"
            aria-hidden
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Icon size={22} weight="fill" color="$gray10" />
            {DirectionIcon && (
              <XStack
                position="absolute"
                bottom={0}
                right={0}
                width={16}
                height={16}
                rounded={8}
                bg="$gray3"
                borderWidth={1}
                borderColor="$background"
                items="center"
                justify="center"
              >
                <DirectionIcon size={10} weight="bold" color="$gray10" />
              </XStack>
            )}
          </XStack>
          <YStack flex={1} minWidth={0} gap={2}>
            <XStack items="center" gap={4}>
              <Text {...appTypography.label1} color={primaryColor} numberOfLines={1} flexShrink={1}>
                {title}
              </Text>
              {pending && !maintenance && (
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
            <Text {...appTypography.body2} color="$gray10" numberOfLines={1}>
              {subtitleStatus ? (
                <>
                  {!activity && subtitleContext ? `${subtitleContext} · ` : null}
                  <Text color={statusColor}>{subtitleStatus}</Text>
                  {activity ? ` · ${subtitleContext}` : null}
                </>
              ) : (
                subtitleContext
              )}
            </Text>
          </YStack>
          <YStack items="flex-end" flexShrink={1} maxWidth="45%" gap={2}>
            <Text
              {...appTypography.label1}
              fontWeight="600"
              color={primaryColor}
              opacity={amountDimmed ? 0.5 : 1}
              numberOfLines={1}
              style={{ fontVariant: ['tabular-nums'] }}
            >
              {signedValue}
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
