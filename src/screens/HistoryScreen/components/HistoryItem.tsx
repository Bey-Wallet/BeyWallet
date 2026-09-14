import React, { useState } from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { Text, XStack, YStack, View as TView, Separator } from 'tamagui';
import {
  ArrowUpRight,
  ArrowDownLeft,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  AlertCircle,
  HelpCircle,
  AtSign,
  QrCode,
  Nfc,
  Box,
  ShieldCheck,
  Bitcoin,
  RefreshCw,
  Zap,
} from '@tamagui/lucide-icons';
import * as Haptics from 'expo-haptics';
import { useQuery } from '@tanstack/react-query';
import { useSettingsStore } from '~/store/settingsStore';
import { currencyService, CurrencyCode } from '~/services/currencyService';
import { bitcoinService } from '~/services/bitcoinService';
import { StatusBadge, BadgeStatus } from '~/components/UI/StatusBadge';
import { proofService, initService, quotesService } from '~/services/core';
import { useToastController } from '@tamagui/toast';
import { useQueryClient } from '@tanstack/react-query';

type ViaResult = { label: string; icon: React.ReactNode; color: string };

function getViaInfo(type: string, metadata?: Record<string, any>): ViaResult {
  const empty: ViaResult = { label: '', icon: null, color: '$gray10' };
  if (!metadata) return empty;

  const defaultColor = '$gray10';

  if (metadata.via === 'nostr' || metadata.nostrPubkey || metadata.nostrUsername) {
    const username = metadata.nostrUsername
      ? `@${metadata.nostrUsername.replace('@bey.cash', '')}`
      : metadata.nostrPubkey
        ? `${String(metadata.nostrPubkey).slice(0, 10)}…`
        : 'Nostr';
    return {
      label: username,
      icon: <AtSign size={10} strokeWidth={2.8} color={defaultColor as any} />,
      color: defaultColor,
    };
  }
  if (metadata.via === 'swap' || metadata.protocol === 'NUT-19' || type === 'swap') {
    const sourceName = metadata.sourceMintName || 'Mint';
    const targetName = metadata.targetMintName || 'Mint';
    return {
      label:
        metadata.sourceMintName && metadata.targetMintName
          ? `${sourceName} ➔ ${targetName}`
          : 'Swap',
      icon: <RefreshCw size={10} strokeWidth={2.8} color={defaultColor as any} />,
      color: defaultColor,
    };
  }
  if (metadata.via === 'nfc') {
    return {
      label: 'NFC',
      icon: <Nfc size={10} strokeWidth={2.8} color={defaultColor as any} />,
      color: defaultColor,
    };
  }
  if (metadata.via === 'qr' || metadata.via === 'scan') {
    return {
      label: 'QR Scan',
      icon: <QrCode size={10} strokeWidth={2.8} color={defaultColor as any} />,
      color: defaultColor,
    };
  }
  if (metadata.via === 'paste') {
    return {
      label: 'Paste',
      icon: <Box size={10} strokeWidth={2.8} color={defaultColor as any} />,
      color: defaultColor,
    };
  }
  if (metadata.via === 'ecash_create') {
    return {
      label: 'Ecash',
      icon: <Box size={10} strokeWidth={2.8} color={defaultColor as any} />,
      color: defaultColor,
    };
  }
  if (metadata.via === 'onchain') {
    return {
      label: 'On-Chain',
      icon: <Bitcoin size={10} strokeWidth={2.8} color={defaultColor as any} />,
      color: defaultColor,
    };
  }
  if (type === 'mint' || type === 'melt' || metadata.via === 'lightning') {
    return {
      label: 'Lightning',
      icon: <Zap size={10} strokeWidth={2.8} color={defaultColor as any} />,
      color: defaultColor,
    };
  }
  if (metadata.type === 'p2pk' || metadata.p2pkPubkey) {
    return {
      label: 'Ecash-P2PK',
      icon: <ShieldCheck size={10} strokeWidth={2.8} color={defaultColor as any} />,
      color: defaultColor,
    };
  }
  return empty;
}

function getTypeLabel(type: string, metadata?: Record<string, any>): string {
  switch (type) {
    case 'send':
      return 'Send';
    case 'receive':
      return 'Receive';
    case 'receive-request':
      return 'Request';
    case 'mint':
      return 'Deposit';
    case 'melt':
      return 'Withdraw';
    case 'swap':
      return 'Swap';
    default:
      return type.charAt(0).toUpperCase() + type.slice(1);
  }
}

function getIconConfig(type: string, isFailed: boolean, metadata?: Record<string, any>) {
  if (isFailed) {
    return AlertCircle;
  }
  switch (type) {
    case 'send':
      return ArrowUpRight;
    case 'receive':
      return ArrowDownLeft;
    case 'mint':
      return ArrowDownToLine;
    case 'melt':
      return ArrowUpFromLine;
    case 'swap':
      return ArrowLeftRight;
    case 'receive-request':
      return Box;
    default:
      return HelpCircle;
  }
}

export interface HistoryItemProps {
  id: string;
  type: string;
  amount: number;
  createdAt: number;
  status: string;
  metadata?: Record<string, any>;
  onPress: (id: string, type: string) => void;
  mintUrl?: string;
  quoteId?: string;
  position?: 'first' | 'middle' | 'last' | 'only';
}

export const HistoryItem = React.memo<HistoryItemProps>(
  ({ id, type, amount, status, metadata, onPress, mintUrl, quoteId, position = 'middle' }) => {
    const { primaryCurrency, secondaryCurrency } = useSettingsStore();
    const toast = useToastController();
    const queryClient = useQueryClient();
    const [isChecking, setIsChecking] = useState(false);

    const { data: btcData } = useQuery({
      queryKey: ['bitcoinPrice', secondaryCurrency],
      queryFn: () => bitcoinService.fetchPrice(secondaryCurrency),
      staleTime: 30000,
      enabled: primaryCurrency !== 'SATS',
    });

    const fiatAmount = React.useMemo(() => {
      if (!btcData?.price) return 0;
      return currencyService.convertSatsToCurrency(amount, btcData.price);
    }, [amount, btcData?.price]);

    const formattedFiat = React.useMemo(() => {
      return currencyService.formatValue(fiatAmount, secondaryCurrency as CurrencyCode);
    }, [fiatAmount, secondaryCurrency]);

    const isOutgoing = type === 'send' || type === 'melt';
    const isPending =
      status.toLowerCase() === 'pending' ||
      status.toLowerCase() === 'unpaid' ||
      status.toLowerCase() === 'unclaimed';

    const isFailed =
      status.toLowerCase() === 'failed' ||
      status.toLowerCase() === 'error' ||
      status.toLowerCase() === 'expired' ||
      status.toLowerCase() === 'refunded';

    const expiresAt = metadata?.expiresAt;
    const isExpired = expiresAt && Date.now() > Number(expiresAt);

    const Icon = getIconConfig(type, isFailed, metadata);
    const label = getTypeLabel(type, metadata);
    const sign = type === 'swap' || type === 'receive-request' ? '' : isOutgoing ? '−' : '+';

    const handlePress = () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onPress(id, type);
    };

    const handleCheckStatus = async () => {
      if (isChecking) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setIsChecking(true);
      try {
        let token = metadata?.token;
        if (token && typeof token === 'string') {
          const states = await proofService.checkProofStates(token);
          const isSpent = states.some((s: any) => s.state === 'SPENT');
          if (isSpent) {
            const repo = initService.getRepo();
            if (repo?.historyRepository) {
              await (repo.historyRepository as any).updateHistoryEntryState(id, 'claimed');
            }
            toast.show('Claimed!', { message: 'Token has been claimed' });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            queryClient.invalidateQueries({ queryKey: ['history'] });
          } else {
            toast.show('Still Pending', { message: 'Token has not been claimed yet' });
          }
        } else if (type === 'mint' && quoteId && mintUrl) {
          try {
            await quotesService.redeemMintQuote(mintUrl, quoteId);
            toast.show('Deposit Successful!', { message: 'Funds have been received' });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            queryClient.invalidateQueries({ queryKey: ['history'] });
          } catch (err: any) {
            toast.show('Still Pending', { message: err?.message || 'Invoice is not paid yet' });
          }
        } else {
          toast.show('Pending', { message: 'Waiting for transaction to complete' });
        }
      } catch (e: any) {
        console.warn('[HistoryItem] Status check failed:', e);
        toast.show('Check Failed', { message: e?.message || 'Could not verify status' });
      } finally {
        setIsChecking(false);
      }
    };

    const badgeStatus: BadgeStatus = isExpired
      ? 'expired'
      : isPending
        ? 'pending'
        : isFailed
          ? 'failed'
          : 'success';

    const showTopSeparator = position === 'first' || position === 'only';

    return (
      <YStack>
        {/* Render top separator only for the first element in a group to prevent overlapping */}
        {showTopSeparator && <Separator borderColor="$borderColor" opacity={0.3} />}

        <XStack py="$3" items="center">
          <TouchableOpacity
            onPress={handlePress}
            activeOpacity={0.7}
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
          >
            {/* Left: icon with mono bg circle */}
            <TView
              width={50}
              height={50}
              rounded={1000}
              bg="$gray4"
              items="center"
              justify="center"
              mr="$3"
            >
              <Icon size={20} color="$accent4" strokeWidth={2.8} />
            </TView>

            {/* Middle: title */}
            <YStack flex={1} mr="$2" justify="center">
              <Text fontSize="$4" fontWeight="bold" color="$accent4" numberOfLines={1}>
                {label}
              </Text>
            </YStack>

            {/* Right: primary amount only */}
            <YStack items="flex-end" justify="center" mr={isPending || isFailed ? '$2' : '$0'}>
              <Text
                fontWeight="800"
                fontSize="$5"
                color="$color"
                fontVariant={['tabular-nums'] as any}
              >
                {sign}
                {primaryCurrency === 'SATS' ? currencyService.formatSats(amount) : formattedFiat}
              </Text>
            </YStack>
          </TouchableOpacity>

          {/* Status badge — only for pending or failed */}
          {(isPending || isFailed) && (
            <StatusBadge
              status={badgeStatus}
              onPress={isPending ? handleCheckStatus : undefined}
              isChecking={isChecking}
              size={28}
            />
          )}
        </XStack>

        {/* Bottom separator rendered for every item */}
        <Separator borderColor="$borderColor" opacity={0.3} />
      </YStack>
    );
  },
);
