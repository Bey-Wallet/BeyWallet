import { Spinner } from '~/shared/ui/Spinner';
import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Clock, Check, XCircle } from '@tamagui/lucide-icons';
import { useTheme } from 'tamagui';

export type BadgeStatus =
  'pending' | 'success' | 'failed' | 'unclaimed' | 'expired' | 'refunded' | 'paid';

interface StatusBadgeProps {
  status: BadgeStatus;
  /** Called when the badge is tapped — use to trigger a status refresh. */
  onPress?: () => void | Promise<void>;
  /** When true shows a spinner instead of the icon (e.g. while checking). */
  isChecking?: boolean;
  size?: number;
}

const BADGE_CONFIG: Record<
  BadgeStatus,
  { bg: 'orange10' | 'green10' | 'red10' | 'blue10'; icon: React.ComponentType<any> }
> = {
  pending: { bg: 'orange10', icon: Clock },
  unclaimed: { bg: 'orange10', icon: Clock },
  success: { bg: 'green10', icon: Check },
  paid: { bg: 'green10', icon: Check },
  failed: { bg: 'red10', icon: XCircle },
  expired: { bg: 'red10', icon: XCircle },
  refunded: { bg: 'blue10', icon: Check },
};

export function StatusBadge({ status, onPress, isChecking = false, size = 36 }: StatusBadgeProps) {
  const theme = useTheme();
  const cfg = BADGE_CONFIG[status] ?? BADGE_CONFIG.pending;
  const { Icon } = { Icon: cfg.icon };
  const iconSize = Math.round(size * 0.44);

  const inner = (
    <View
      style={[
        styles.badge,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: theme[cfg.bg].val },
      ]}
    >
      {isChecking ? (
        <Spinner size="small" color={cfg.bg === 'blue10' ? '$onAccent' : 'white'} />
      ) : (
        <Icon
          size={iconSize}
          color={cfg.bg === 'blue10' ? '$onAccent' : 'white'}
          strokeWidth={2.5}
        />
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
