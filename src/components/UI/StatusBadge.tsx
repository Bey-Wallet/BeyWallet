import React from 'react';
import { View, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { Clock, Check, XCircle } from '@tamagui/lucide-icons';
import { useTheme } from 'tamagui';

export type BadgeStatus = 'pending' | 'success' | 'failed' | 'unclaimed' | 'expired' | 'refunded' | 'paid';

interface StatusBadgeProps {
    status: BadgeStatus;
    /** Called when the badge is tapped — use to trigger a status refresh. */
    onPress?: () => void | Promise<void>;
    /** When true shows a spinner instead of the icon (e.g. while checking). */
    isChecking?: boolean;
    size?: number;
}

const BADGE_CONFIG: Record<BadgeStatus, { bg: string; icon: React.ComponentType<any> }> = {
    pending:   { bg: '#f97316', icon: Clock   }, // orange-500
    unclaimed: { bg: '#f97316', icon: Clock   },
    success:   { bg: '#22c55e', icon: Check   }, // green-500
    paid:      { bg: '#22c55e', icon: Check   },
    failed:    { bg: '#ef4444', icon: XCircle }, // red-500
    expired:   { bg: '#ef4444', icon: XCircle },
    refunded:  { bg: '#3b82f6', icon: Check   }, // blue-500
};

export function StatusBadge({ status, onPress, isChecking = false, size = 36 }: StatusBadgeProps) {
    const cfg = BADGE_CONFIG[status] ?? BADGE_CONFIG.pending;
    const { Icon } = { Icon: cfg.icon };
    const iconSize = Math.round(size * 0.44);

    const inner = (
        <View style={[styles.badge, { width: size, height: size, borderRadius: size / 2, backgroundColor: cfg.bg }]}>
            {isChecking ? (
                <ActivityIndicator size="small" color="white" />
            ) : (
                <Icon size={iconSize} color="white" strokeWidth={2.5} />
            )}
        </View>
    );

    if (!onPress) return inner;

    return (
        <Pressable
            onPress={onPress}
            style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
            hitSlop={8}
        >
            {inner}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    badge: {
        alignItems: 'center',
        justifyContent: 'center',
    },
});
