import { useBUITheme } from './useBUITheme';
import React, { useState } from 'react';
import { Text, XStack, YStack } from 'tamagui';
import { Plus } from '@tamagui/lucide-icons';
import { AppPressable } from '~/shared/ui/AppPressable';
import { Spinner } from '~/shared/ui/Spinner';
import type { BUIAppearance } from '~/state/buiStore';
import {
  buiButtonSizes,
  type BUIButtonSize,
  type BUIButtonState,
  type BUIButtonVariant,
} from './theme';

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
  const [pressed, setPressed] = useState(false);
  const theme = useBUITheme(appearance);
  const palette = variant === 'Secondary' ? theme.secondaryButton : theme.buttons[variant];
  const spec = buiButtonSizes[size];
  const disabled = state === 'Disabled' || state === 'Loading';
  const fill = disabled ? palette[1] : pressed || state === 'Highlighted' ? palette[2] : palette[0];
  const color = textOnly
    ? theme.text
    : variant === 'Tertiary' && state === 'Disabled'
      ? theme.tertiaryText
      : palette[3];
  return (
    <YStack
      self={fullWidth ? 'stretch' : 'flex-start'}
      maxWidth="100%"
      width={fullWidth ? '100%' : undefined}
    >
      <AppPressable
        accessibilityLabel={`${children}, ${size}, ${state}`}
        accessibilityState={{ disabled, busy: state === 'Loading' }}
        disabled={disabled}
        minHeight={48}
        justify="center"
        onPress={onPress}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        pressStyle={{ opacity: 1 }}
        hoverStyle={{ opacity: 1 }}
      >
        <XStack
          minHeight={spec.height}
          rounded={spec.radius}
          px={16}
          py={8}
          bg={textOnly ? 'transparent' : fill}
          items="center"
          justify="center"
          gap={8}
        >
          {state === 'Loading' ? (
            <Spinner size={24} color={color} />
          ) : (
            <>
              {icon && <Plus size={16} color={color} />}
              <Text
                fontFamily="$body"
                fontWeight="500"
                fontSize={spec.fontSize}
                letterSpacing={spec.fontSize * 0.005}
                color={color}
                textAlign="center"
                style={{ includeFontPadding: false }}
              >
                {children}
              </Text>
            </>
          )}
        </XStack>
      </AppPressable>
    </YStack>
  );
}

export function BUIActionButton({
  appearance,
  title,
  children,
  plain = false,
  onPress,
}: {
  appearance: BUIAppearance;
  title: string;
  children: React.ReactNode;
  plain?: boolean;
  onPress: () => void;
}) {
  const theme = useBUITheme(appearance);
  return (
    <AppPressable
      accessibilityLabel={title}
      minHeight={84}
      width={76}
      items="center"
      justify="center"
      onPress={onPress}
    >
      <YStack
        width={plain ? 28 : 44}
        height={plain ? 28 : 44}
        rounded={22}
        bg={plain ? 'transparent' : theme.secondaryButton[0]}
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
        color={theme.muted}
      >
        {title}
      </Text>
    </AppPressable>
  );
}
