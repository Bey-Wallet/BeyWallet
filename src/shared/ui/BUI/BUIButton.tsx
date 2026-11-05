import { useBUITheme } from './useBUITheme';
import React from 'react';
import { BUIButtonControl } from './BUIButtonControl';
import { Text, YStack } from 'tamagui';
import { Plus } from '@tamagui/lucide-icons';
import { AppPressable } from '~/shared/ui/AppPressable';
import type { BUIAppearance } from '~/state/buiStore';
import { type BUIButtonSize, type BUIButtonState, type BUIButtonVariant } from './theme';

export function BUIButton({
  appearance,
  variant = 'Primary',
  size = 'medium',
  state = 'Default',
  children,
  icon = false,
  textOnly = false,
  fullWidth = false,
  onPress,
}: {
  appearance: BUIAppearance;
  variant?: BUIButtonVariant;
  size?: BUIButtonSize;
  state?: BUIButtonState;
  children: string;
  icon?: boolean;
  textOnly?: boolean;
  fullWidth?: boolean;
  onPress: () => void;
}) {
  const theme = useBUITheme(appearance);
  const palette = variant === 'Secondary' ? theme.secondaryButton : theme.buttons[variant];
  return (
    <BUIButtonControl
      paletteOverride={palette}
      emphasis={textOnly ? 'text' : variant === 'Tertiary' ? 'ghost' : 'primary'}
      size={size === 'small' ? 'xsmall' : size}
      disabled={state === 'Disabled'}
      loading={state === 'Loading'}
      highlighted={state === 'Highlighted'}
      textColor={textOnly ? theme.text : undefined}
      fullWidth={fullWidth}
      icon={icon ? Plus : undefined}
      onPress={onPress}
    >
      {children}
    </BUIButtonControl>
  );
}

export function BUIActionButton({
  appearance,
  title,
  accessibilityLabel = title,
  children,
  plain = false,
  flex,
  onPress,
}: {
  appearance?: BUIAppearance;
  title: string;
  accessibilityLabel?: string;
  children: React.ReactNode;
  plain?: boolean;
  flex?: number;
  onPress: () => void;
}) {
  const theme = useBUITheme(appearance);
  return (
    <AppPressable
      accessibilityLabel={accessibilityLabel}
      minHeight={84}
      width={flex ? undefined : 76}
      minWidth={48}
      flex={flex}
      items="center"
      justify="center"
      onPress={onPress}
    >
      <YStack
        aria-hidden
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        width={plain ? 28 : 48}
        height={plain ? 28 : 48}
        rounded={24}
        bg={
          plain ? 'transparent' : appearance ? theme.secondaryButton[0] : '$buttonDefaultSecondary'
        }
        items="center"
        justify="center"
      >
        {children}
      </YStack>
      <Text
        mt={plain ? 4 : 8}
        fontFamily="$body"
        fontWeight="500"
        fontSize={12}
        letterSpacing={0.12}
        color={appearance ? theme.muted : '$gray10'}
      >
        {title}
      </Text>
    </AppPressable>
  );
}
