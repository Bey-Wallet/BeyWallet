import React, { useState } from 'react';
import { StyleSheet, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Text, XStack, YStack } from 'tamagui';
import {
    BanknoteArrowUp,
    BanknoteArrowDown,
    Landmark,
    RefreshCw,
    Zap,
    AtSign,
    QrCode,
    Nfc,
    Box,
    ShieldCheck,
    Clock,
    Bitcoin,
} from '@tamagui/lucide-icons';
import * as Haptics from 'expo-haptics';
import { useQuery } from '@tanstack/react-query';
import { useSettingsStore } from '~/store/settingsStore';
import { currencyService, CurrencyCode } from '~/services/currencyService';
import { bitcoinService } from '~/services/bitcoinService';
import { StatusBadge, BadgeStatus } from '~/components/UI/StatusBadge';
import { proofService, walletService, initService, cleanToken, decodeToken, quotesService } from '~/services/core';
import { useToastController } from '@tamagui/toast';
import { useQueryClient } from '@tanstack/react-query';

type ViaResult = { label: string; icon: React.ReactNode; color: string };

function getViaInfo(type: string, metadata?: Record<string, any>): ViaResult {
    const empty: ViaResult = { label: '', icon: null, color: '$gray10' };
    if (!metadata) return empty;

    if (metadata.via === 'nostr' || metadata.nostrPubkey || metadata.nostrUsername) {
        const username = metadata.nostrUsername
            ? `@${metadata.nostrUsername.replace('@bey.cash', '')}`
            : metadata.nostrPubkey
                ? `${String(metadata.nostrPubkey).slice(0, 10)}…`
                : 'Nostr';
        return {
            label: `Via Nostr · ${username}`,
            icon: <AtSign size={10} strokeWidth={2.5} color="#a855f7" />,
            color: '#a855f7',
        };
    }
    if (metadata.via === 'swap' || metadata.protocol === 'NUT-19' || type === 'swap') {
        const sourceName = metadata.sourceMintName || 'Mint';
        const targetName = metadata.targetMintName || 'Mint';
        return {
            label: metadata.sourceMintName && metadata.targetMintName ? `${sourceName} ➔ ${targetName}` : 'NUT-19 Atomic Swap',
            icon: <RefreshCw size={10} strokeWidth={2.5} color="#3b82f6" />,
            color: '#3b82f6'
        };
    }
    if (metadata.via === 'nfc') {
        return { label: 'Via NFC', icon: <Nfc size={10} strokeWidth={2.5} color="#3b82f6" />, color: '#3b82f6' };
    }
    if (metadata.via === 'qr' || metadata.via === 'scan') {
        return { label: 'Via QR Scan', icon: <QrCode size={10} strokeWidth={2.5} color="#22c55e" />, color: '#22c55e' };
    }
    if (metadata.via === 'paste') {
        return { label: 'Via Paste', icon: <Box size={10} strokeWidth={2.5} color="#71717a" />, color: '#71717a' };
    }
    if (metadata.via === 'ecash_create') {
        return { label: 'Ecash Token', icon: <Box size={10} strokeWidth={2.5} color="#f97316" />, color: '#f97316' };
    }
    if (metadata.via === 'onchain') {
        return { label: 'On-chain BTC', icon: <Bitcoin size={10} strokeWidth={2.5} color="#f59e0b" />, color: '#f59e0b' };
    }
    if (type === 'mint' || type === 'melt' || metadata.via === 'lightning') {
        return { label: 'Via Lightning', icon: <Zap size={10} strokeWidth={2.5} color="#eab308" />, color: '#eab308' };
    }
    if (metadata.type === 'p2pk' || metadata.p2pkPubkey) {
        return { label: 'P2PK Locked', icon: <ShieldCheck size={10} strokeWidth={2.5} color="$orange10" />, color: '$orange10' };
    }
    return empty;
}

function getTypeLabel(type: string, metadata?: Record<string, any>): string {
    switch (type) {
        case 'send':
            if (metadata?.via === 'nostr') return 'Sent via Nostr';
            if (metadata?.via === 'ecash_create') return 'Created Ecash';
            return 'Sent';
        case 'receive':
            if (metadata?.via === 'nostr') return 'Received via Nostr';
            if (metadata?.via === 'qr' || metadata?.via === 'scan') return 'Received via QR';
            if (metadata?.via === 'nfc') return 'Received via NFC';
            return 'Received';
        case 'receive-request': return 'Payment Request';
        case 'mint':
            if (metadata?.via === 'onchain') return 'On-chain Receive';
            return 'Lightning Receive';
        case 'melt':
            if (metadata?.via === 'onchain') return 'On-chain Send';
            return 'Lightning Send';
        case 'swap': return 'NUT-19 Atomic Swap';
        default: return type.charAt(0).toUpperCase() + type.slice(1);
    }
}

// Map type to icon + colors (solid bg circle)
function getIconConfig(type: string, metadata?: Record<string, any>) {
    switch (type) {
        case 'send':
            return { Icon: BanknoteArrowUp, bg: '#ff414120', tint: '#ff6b6b' };
        case 'receive':
            return { Icon: BanknoteArrowDown, bg: '#22c55e20', tint: '#4ade80' };
        case 'mint':
            if (metadata?.via === 'onchain') return { Icon: Bitcoin, bg: '#f59e0b20', tint: '#fbbf24' };
            return { Icon: Landmark, bg: '#f59e0b20', tint: '#fbbf24' };
        case 'melt':
            if (metadata?.via === 'onchain') return { Icon: Bitcoin, bg: '#f59e0b20', tint: '#fbbf24' };
            return { Icon: Zap, bg: '#f59e0b20', tint: '#fbbf24' };
        case 'swap':
            return { Icon: RefreshCw, bg: '#3b82f620', tint: '#60a5fa' };
        case 'receive-request':
            return { Icon: Box, bg: '#a855f720', tint: '#c084fc' };
        default:
            return { Icon: BanknoteArrowDown, bg: '#22c55e20', tint: '#4ade80' };
    }
}

function getExpiryTimeLeftLabel(expiresAt?: any): string | null {
    if (!expiresAt) return null;
    const diff = Number(expiresAt) - Date.now();
    if (diff <= 0) return 'Expired';
    const hours = Math.floor(diff / (60 * 60 * 1000));
    if (hours > 0) return `Expires in ${hours}h`;
    const mins = Math.floor(diff / (60 * 1000));
    if (mins > 0) return `Expires in ${mins}m`;
    return `Expires in <1m`;
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
}

export const HistoryItem = React.memo<HistoryItemProps>(({
    id,
    type,
    amount,
    status,
    metadata,
    onPress,
    mintUrl,
    quoteId,
}) => {
    const { primaryCurrency, secondaryCurrency } = useSettingsStore();
    const toast = useToastController();
    const queryClient = useQueryClient();
    const [isChecking, setIsChecking] = useState(false);

    const { data: btcData } = useQuery({
        queryKey: ['bitcoinPrice', secondaryCurrency],
        queryFn: () => bitcoinService.fetchPrice(secondaryCurrency),
        staleTime: 30000,
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

    const isFailed = status.toLowerCase() === 'failed' || status.toLowerCase() === 'error' || status.toLowerCase() === 'expired' || status.toLowerCase() === 'refunded';

    const expiresAt = metadata?.expiresAt;
    const isExpired = expiresAt && Date.now() > Number(expiresAt);

    const { Icon, bg, tint } = getIconConfig(type, metadata);
    const viaInfo = getViaInfo(type, metadata);
    const label = getTypeLabel(type, metadata);

    const sign = type === 'swap' || type === 'receive-request' ? '' : isOutgoing ? '−' : '+';

    const handlePress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress(id, type);
    };

    // Status check for pending items — tap the badge to refresh proof state
    const handleCheckStatus = async () => {
        if (isChecking) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setIsChecking(true);
        try {
            // 1. If it has a token (pending ecash)
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
            } 
            // 2. If it's a pending mint with quoteId (lightning/on-chain deposit)
            else if (type === 'mint' && quoteId && mintUrl) {
                try {
                    await quotesService.redeemMintQuote(mintUrl, quoteId);
                    toast.show('Deposit Successful!', { message: 'Funds have been received' });
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    queryClient.invalidateQueries({ queryKey: ['history'] });
                } catch (err: any) {
                    toast.show('Still Pending', { message: err?.message || 'Invoice is not paid yet' });
                }
            }
            // 3. Otherwise, just show a message
            else {
                toast.show('Pending', { message: 'Waiting for transaction to complete' });
            }
        } catch (e: any) {
            console.warn('[HistoryItem] Status check failed:', e);
            toast.show('Check Failed', { message: e?.message || 'Could not verify status' });
        } finally {
            setIsChecking(false);
        }
    };

    const expiryLabel = isPending && expiresAt ? getExpiryTimeLeftLabel(expiresAt) : null;
    const subtitle = [viaInfo.label, expiryLabel].filter(Boolean).join(' · ');

    // Badge status derivation
    const badgeStatus: BadgeStatus = isExpired ? 'expired' : isPending ? 'pending' : isFailed ? 'failed' : 'success';

    return (
        <XStack
            bg="$gray2"
            my="$1"
            px="$2"
            py="$3"
            items="center"
            pr="$3"
            rounded="$4"
        >
            <TouchableOpacity
                onPress={handlePress}
                activeOpacity={0.7}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
            >
                {/* Left: icon with bg circle */}
                <View style={[styles.iconCircle, { backgroundColor: bg }]}>
                    <Icon size={20} color={tint as any} strokeWidth={2.2} />
                </View>

                {/* Middle: title + subtitle */}
                <YStack flex={1} gap="$0.5" mr="$2">
                    <XStack items="center" gap="$1.5">
                        <Text fontSize="$4" fontWeight="700" color="$color" numberOfLines={1}>
                            {label}
                        </Text>
                    </XStack>
                    {subtitle ? (
                        <XStack items="center" gap="$1.5">
                            {viaInfo.icon || <Clock size={10} strokeWidth={2.5} color="$orange10" />}
                            <Text fontSize="$2" color="$gray10" numberOfLines={1}>
                                {subtitle}
                            </Text>
                        </XStack>
                    ) : null}
                </YStack>

                {/* Right: amount */}
                <YStack items="flex-end" justify="center" mr={(isPending || isFailed) ? "$2" : "$0"}>
                    {primaryCurrency === 'SATS' ? (
                        <>
                            <Text
                                fontWeight="800"
                                fontSize="$4"
                                color="$color"
                                fontVariant={['tabular-nums'] as any}
                            >
                                {sign}₿{amount.toLocaleString()}
                            </Text>
                            <Text
                                fontSize="$2"
                                color="$gray10"
                                fontWeight="600"
                                fontVariant={['tabular-nums'] as any}
                            >
                                {sign}{formattedFiat}
                            </Text>
                        </>
                    ) : (
                        <>
                            <Text
                                fontWeight="800"
                                fontSize="$4"
                                color="$color"
                                fontVariant={['tabular-nums'] as any}
                            >
                                {sign}{formattedFiat}
                            </Text>
                            <Text
                                fontSize="$2"
                                color="$gray10"
                                fontWeight="600"
                                fontVariant={['tabular-nums'] as any}
                            >
                                {sign}₿{amount.toLocaleString()}
                            </Text>
                        </>
                    )}
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
    );
});

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
       
    },
    iconCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
});
