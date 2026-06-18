import React from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { Text, XStack, YStack, useTheme } from 'tamagui';
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
} from '@tamagui/lucide-icons';
import * as Haptics from 'expo-haptics';

interface HistoryItemProps {
    id: string;
    type: string;
    amount: number;
    createdAt: number;
    status: string;
    metadata?: Record<string, any>;
    onPress: () => void;
}

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
            icon: <AtSign size={10} strokeWidth={2.5} color="$purple10" />,
            color: '$purple10',
        };
    }
    if (metadata.via === 'nfc') {
        return { label: 'Via NFC', icon: <Nfc size={10} strokeWidth={2.5} color="$blue10" />, color: '$blue10' };
    }
    if (metadata.via === 'qr' || metadata.via === 'scan') {
        return { label: 'Via QR Scan', icon: <QrCode size={10} strokeWidth={2.5} color="$green10" />, color: '$green10' };
    }
    if (metadata.via === 'paste') {
        return { label: 'Via Paste', icon: <Box size={10} strokeWidth={2.5} color="$gray10" />, color: '$gray10' };
    }
    if (metadata.via === 'ecash_create') {
        return { label: 'Ecash Token', icon: <Box size={10} strokeWidth={2.5} color="$orange9" />, color: '$orange9' };
    }
    if (type === 'mint' || type === 'melt' || metadata.via === 'lightning') {
        return { label: 'Via Lightning', icon: <Zap size={10} strokeWidth={2.5} color="$yellow10" />, color: '$yellow10' };
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
        case 'swap': return 'Optimized';
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

export const HistoryItem: React.FC<HistoryItemProps> = ({
    type,
    amount,
    status,
    metadata,
    onPress,
}) => {
    const isOutgoing = type === 'send' || type === 'melt';
    const isPending =
        status.toLowerCase() === 'pending' ||
        status.toLowerCase() === 'unpaid' ||
        status.toLowerCase() === 'unclaimed';

    const { Icon, bg, tint } = getIconConfig(type, metadata);
    const viaInfo = getViaInfo(type, metadata);
    const label = getTypeLabel(type, metadata);

    const sign = type === 'swap' || type === 'receive-request' ? '' : isOutgoing ? '−' : '+';
    const amountColor = type === 'swap' ? '#60a5fa' : isOutgoing ? '#ff6b6b' : '#4ade80';

    const handlePress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
    };

    const theme = useTheme();

    return (
        <TouchableOpacity
            onPress={handlePress}
            activeOpacity={0.7}
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 14,
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
                    <Text fontSize="$5" fontWeight="600" color="$accent5">
                        {label}
                    </Text>
                    {isPending && (
                        <View style={[styles.badge, { backgroundColor: '#f59e0b22' }]}>
                            <Text fontSize={9} fontWeight="800" color="$orange10" style={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                {status}
                            </Text>
                        </View>
                    )}
                </XStack>
                {viaInfo.label ? (
                    <XStack items="center" gap="$1" mt="$1">
                        {viaInfo.icon}
                        <Text fontSize="$3" color="$gray9" numberOfLines={1}>
                            {viaInfo.label}
                        </Text>
                    </XStack>
                ) : null}
            </YStack>

            {/* Right Side: Amount */}
            <Text
                fontWeight="800"
                fontSize="$5"
                color="$accent3"
                fontVariant={['tabular-nums'] as any}
            >
                {sign}₿{amount.toLocaleString()}
            </Text>
        </TouchableOpacity>
    );
};

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
