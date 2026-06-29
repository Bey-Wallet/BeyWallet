import React from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
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
    ChevronRight,
    Clock,
} from '@tamagui/lucide-icons';
import * as Haptics from 'expo-haptics';
import { useQuery } from '@tanstack/react-query';
import { useSettingsStore } from '../../../store/settingsStore';
import { currencyService, CurrencyCode } from '../../../services/currencyService';
import { bitcoinService } from '../../../services/bitcoinService';

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
        case 'mint': return 'Lightning Receive';
        case 'melt': return 'Lightning Send';
        case 'swap': return 'NUT-19 Atomic Swap';
        default: return type.charAt(0).toUpperCase() + type.slice(1);
    }
}

// Map type to icon + colors
function getIconConfig(type: string, metadata?: Record<string, any>) {
    const isOutgoing = type === 'send' || type === 'melt';
    switch (type) {
        case 'send':
            return { Icon: BanknoteArrowUp, bg: '#ff414115', tint: '#ff6b6b' };
        case 'receive':
            return { Icon: BanknoteArrowDown, bg: '#22c55e18', tint: '#4ade80' };
        case 'mint':
            return { Icon: Landmark, bg: '#f59e0b18', tint: '#fbbf24' };
        case 'melt':
            return { Icon: Zap, bg: '#f59e0b18', tint: '#fbbf24' };
        case 'swap':
            return { Icon: RefreshCw, bg: '#3b82f618', tint: '#60a5fa' };
        case 'receive-request':
            return { Icon: Box, bg: '#a855f718', tint: '#c084fc' };
        default:
            return { Icon: BanknoteArrowDown, bg: '#22c55e18', tint: '#4ade80' };
    }
}

function getExpiryTimeLeftLabel(expiresAt?: any): string | null {
    if (!expiresAt) return null;
    const diff = Number(expiresAt) - Date.now();
    if (diff <= 0) return 'Expired';
    const hours = Math.floor(diff / (60 * 60 * 1000));
    if (hours > 0) {
        return `Expires in ${hours}h`;
    }
    const mins = Math.floor(diff / (60 * 1000));
    if (mins > 0) {
        return `Expires in ${mins}m`;
    }
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
}

export const HistoryItem = React.memo<HistoryItemProps>(({
    id,
    type,
    amount,
    status,
    metadata,
    onPress,
}) => {
    const { primaryCurrency, secondaryCurrency } = useSettingsStore();

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

    const expiryLabel = isPending && expiresAt ? getExpiryTimeLeftLabel(expiresAt) : null;
    const subtitle = [viaInfo.label, expiryLabel].filter(Boolean).join(' · ');

    return (
        <TouchableOpacity
            onPress={handlePress}
            activeOpacity={0.7}
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 12,
                paddingHorizontal: 16,
            }}
        >
            {/* Left Icon */}
            <View style={{ marginRight: 12 }}>
                <Icon size={22} color={tint as any} strokeWidth={2.2} />
            </View>

            {/* Middle Section: Title + Subtitle */}
            <YStack flex={1} gap="$0.5" mr="$2">
                <XStack flexWrap="wrap" items="center" gap="$1.5">
                    <Text fontSize="$4" fontWeight="700" color="$accent5">
                        {label}
                    </Text>
                    {isPending ? (
                        <View style={[styles.badge, { backgroundColor: isExpired ? 'rgba(239, 68, 68, 0.12)' : 'rgba(245, 158, 11, 0.12)' }]}>
                            <Text fontSize={9} fontWeight="900" color={isExpired ? "$red10" : "$orange10"} style={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                {isExpired ? 'EXPIRED' : status}
                            </Text>
                        </View>
                    ) : status.toLowerCase() === 'expired' || status.toLowerCase() === 'refunded' ? (
                        <View style={[styles.badge, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}>
                            <Text fontSize={9} fontWeight="900" color="$red10" style={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                {status}
                            </Text>
                        </View>
                    ) : null}
                </XStack>
                {subtitle ? (
                    <XStack items="center" gap="$1.5" mt="$0.5">
                        {viaInfo.icon || <Clock size={10} strokeWidth={2.5} color="$orange10" />}
                        <Text fontSize="$2" color="$gray10" numberOfLines={1}>
                            {subtitle}
                        </Text>
                    </XStack>
                ) : null}
            </YStack>

            {/* Right Side: Amount */}
            <YStack items="flex-end" justify="center">
                {primaryCurrency === 'SATS' ? (
                    <>
                        <Text
                            fontWeight="900"
                            fontSize="$5"
                            color="$accent3"
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
                            fontWeight="900"
                            fontSize="$5"
                            color="$accent3"
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
    );
});

const styles = StyleSheet.create({
    touchable: {
        backgroundColor: 'transparent',
    },
    iconBadge: {
        width: 38,
        height: 38,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    badge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
});
