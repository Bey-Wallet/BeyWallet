import React, { useState } from 'react';
import { StyleSheet, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Text, XStack, YStack, View as TView } from 'tamagui';
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
            label: metadata.sourceMintName && metadata.targetMintName ? `${sourceName} ➔ ${targetName}` : 'Swap',
            icon: <RefreshCw size={10} strokeWidth={2.8} color={defaultColor as any} />,
            color: defaultColor
        };
    }
    if (metadata.via === 'nfc') {
        return { label: 'NFC', icon: <Nfc size={10} strokeWidth={2.8} color={defaultColor as any} />, color: defaultColor };
    }
    if (metadata.via === 'qr' || metadata.via === 'scan') {
        return { label: 'QR Scan', icon: <QrCode size={10} strokeWidth={2.8} color={defaultColor as any} />, color: defaultColor };
    }
    if (metadata.via === 'paste') {
        return { label: 'Paste', icon: <Box size={10} strokeWidth={2.8} color={defaultColor as any} />, color: defaultColor };
    }
    if (metadata.via === 'ecash_create') {
        return { label: 'Ecash', icon: <Box size={10} strokeWidth={2.8} color={defaultColor as any} />, color: defaultColor };
    }
    if (metadata.via === 'onchain') {
        return { label: 'On-Chain', icon: <Bitcoin size={10} strokeWidth={2.8} color={defaultColor as any} />, color: defaultColor };
    }
    if (type === 'mint' || type === 'melt' || metadata.via === 'lightning') {
        return { label: 'Lightning', icon: <Zap size={10} strokeWidth={2.8} color={defaultColor as any} />, color: defaultColor };
    }
    if (metadata.type === 'p2pk' || metadata.p2pkPubkey) {
        return { label: 'Ecash-P2PK', icon: <ShieldCheck size={10} strokeWidth={2.8} color={defaultColor as any} />, color: defaultColor };
    }
    return empty;
}

function getSubtitleText(type: string, metadata?: Record<string, any>): string {
    if (!metadata) {
        if (type === 'swap') return 'Swap';
        if (type === 'mint') return 'Lightning';
        if (type === 'melt') return 'Lightning';
        return 'Ecash';
    }

    const via = metadata.via;
    const isP2PK = metadata.type === 'p2pk' || metadata.p2pkPubkey || metadata.lockToNpub;
    
    let base = 'Ecash';

    if (via === 'onchain') {
        base = 'On-Chain';
    } else if (via === 'lightning' || type === 'mint' || type === 'melt') {
        if (via !== 'onchain') {
            base = 'Lightning';
        } else {
            base = 'On-Chain';
        }
    } else if (via === 'swap' || type === 'swap') {
        base = 'Swap';
    } else if (via === 'nfc') {
        base = 'NFC';
    } else if (via === 'nostr') {
        base = 'Nostr';
    } else if (via === 'qr' || via === 'scan') {
        base = 'QR Scan';
    }

    if (isP2PK) {
        base = `${base}-P2PK`;
    }

    if (metadata.nostrUsername) {
        const username = `@${metadata.nostrUsername.replace('@bey.cash', '')}`;
        return `${base} · ${username}`;
    } else if (metadata.nostrPubkey) {
        const pubkey = String(metadata.nostrPubkey);
        return `${base} · ${pubkey.slice(0, 10)}…`;
    }

    if (via === 'swap' || type === 'swap') {
        const sourceName = metadata.sourceMintName || 'Mint';
        const targetName = metadata.targetMintName || 'Mint';
        if (metadata.sourceMintName && metadata.targetMintName) {
            return `${base} · ${sourceName} ➔ ${targetName}`;
        }
    }

    return base;
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

    const Icon = getIconConfig(type, isFailed, metadata);
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

    const subLabel = getSubtitleText(type, metadata);
    const expiryLabel = isPending && expiresAt ? getExpiryTimeLeftLabel(expiresAt) : null;
    const subtitle = [subLabel, expiryLabel].filter(Boolean).join(' · ');

    // Badge status derivation
    const badgeStatus: BadgeStatus = isExpired ? 'expired' : isPending ? 'pending' : isFailed ? 'failed' : 'success';

    return (
        <XStack
            bg="$gray2"
            my="$1"
            px="$3"
            py="$3.5"
            items="center"
            pr="$3.5"
            rounded="$6"
        >
            <TouchableOpacity
                onPress={handlePress}
                activeOpacity={0.7}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
            >
                {/* Left: icon with mono bg circle */}
                <TView
                    width={40}
                    height={40}
                    borderRadius={21}
                    bg="$gray4"
                    items="center"
                    justify="center"
                    marginRight="$3"
                >
                    <Icon size={20} color="$accent4" strokeWidth={2.8} />
                </TView>

                {/* Middle: title + subtitle */}
                <YStack flex={1} gap="$0.5" mr="$2" justify="center">
                    <XStack items="center" gap="$1.5" flex={1}>
                        <Text fontSize="$4" fontWeight="bold" color="$accent4" numberOfLines={1} flex={1}>
                            {label}
                        </Text>
                    </XStack>
                    {subtitle ? (
                        <XStack items="center" gap="$1.5" flex={1} mt="$0.5">
                            <TView mt="$0.5">
                                {viaInfo.icon || <Clock size={10} strokeWidth={2.8} color="$gray10" />}
                            </TView>
                            <Text fontSize="$2" color="$gray10" flex={1}>
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
                                fontSize="$5"
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
                                fontSize="$5"
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
