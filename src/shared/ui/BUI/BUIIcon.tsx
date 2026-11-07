import React from 'react';
import { I18nManager } from 'react-native';
import {
  ArrowDown,
  ArrowUp,
  ArrowLeft,
  ChevronRight,
  X,
  Plus,
  Check,
  CheckCircle2,
  BadgeCheck,
  Wallet,
} from '@tamagui/lucide-icons';
import { YStack } from 'tamagui';
import { AppPressable } from '~/shared/ui/AppPressable';
import { useBUITheme } from './useBUITheme';
export const buiIconDefinitions = {
  close: { Icon: X, size: 16 },
  back: { Icon: ArrowLeft, size: 16 },
  chevron: { Icon: ChevronRight, size: 16 },
  plus: { Icon: Plus, size: 16 },
  check: { Icon: Check, size: 16 },
  checkCircle: { Icon: CheckCircle2, size: 16 },
  verification: { Icon: BadgeCheck, size: 16 },
  receive: { Icon: ArrowDown, size: 16 },
  receiveLarge: { Icon: ArrowDown, size: 28 },
  sendLarge: { Icon: ArrowUp, size: 28 },
  wallet: { Icon: Wallet, size: 28 },
  walletSmall: { Icon: Wallet, size: 16 },
} as const;
export type BUIIconName = keyof typeof buiIconDefinitions;
export type BUIIconTone =
  'primary' | 'secondary' | 'tertiary' | 'accent' | 'success' | 'warning' | 'error';

export function BUIIcon({
  name,
  size,
  tone = 'primary',
  color,
  label,
}: {
  name: BUIIconName;
  size?: number;
  tone?: BUIIconTone;
  color?: string;
  label?: string;
}) {
  const c = useBUITheme();
  const { Icon, size: defaultSize } = buiIconDefinitions[name];
  const tint =
    color ??
    {
      primary: c.icon,
      secondary: c.iconSecondary,
      tertiary: c.iconTertiary,
      accent: c.primary,
      success: c.positive,
      warning: c.warning,
      error: c.negative,
    }[tone];
  return (
    <Icon
      size={size ?? defaultSize}
      color={tint}
      strokeWidth={1.8}
      accessible={!!label}
      accessibilityLabel={label}
      style={
        (name === 'back' || name === 'chevron') && I18nManager.isRTL
          ? { transform: [{ scaleX: -1 }] }
          : undefined
      }
    />
  );
}

export function BUICircleIcon({
  name,
  size = 36,
  iconSize = 20,
  tone = 'secondary',
}: {
  name: BUIIconName;
  size?: number;
  iconSize?: number;
  tone?: BUIIconTone;
}) {
  const c = useBUITheme();
  return (
    <YStack
      width={size}
      height={size}
      rounded={size / 2}
      bg={c.pressed}
      items="center"
      justify="center"
    >
      <BUIIcon name={name} size={iconSize} tone={tone} />
    </YStack>
  );
}

export function BUIIconButton({
  name,
  label,
  onPress,
  size = 32,
  iconSize = 16,
  disabled = false,
}: {
  name: BUIIconName;
  label: string;
  onPress: () => void;
  size?: number;
  iconSize?: number;
  disabled?: boolean;
}) {
  const c = useBUITheme();
  return (
    <AppPressable
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      minWidth={Math.max(48, size)}
      minHeight={Math.max(48, size)}
      items="center"
      justify="center"
      opacity={disabled ? 0.4 : 1}
      onPress={onPress}
    >
      <YStack
        width={size}
        height={size}
        rounded={size / 2}
        bg={c.secondaryButton[0]}
        items="center"
        justify="center"
      >
        <BUIIcon name={name} size={iconSize} color={c.buttons.Secondary[3]} />
      </YStack>
    </AppPressable>
  );
}
