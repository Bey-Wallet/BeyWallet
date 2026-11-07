import React, { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { Check, Info } from '@tamagui/lucide-icons';
import { XStack, YStack } from 'tamagui';
import { AppPressable } from '~/shared/ui/AppPressable';
import { useReducedMotion } from '~/shared/hooks/useReducedMotion';
import { useBUITheme } from './useBUITheme';
import { BUIText } from './BUIText';

export type BUISelectionKind = 'switch' | 'checkbox' | 'radio';
export type BUISelectionProps = {
  checked: boolean;
  label: string;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
};

function SwitchVisual({ checked, disabled = false }: { checked: boolean; disabled?: boolean }) {
  const c = useBUITheme();
  const reducedMotion = useReducedMotion();
  const progress = useRef(new Animated.Value(checked ? 1 : 0)).current;
  useEffect(() => {
    if (reducedMotion) {
      progress.setValue(checked ? 1 : 0);
      return;
    }
    const motion = Animated.spring(progress, {
      toValue: checked ? 1 : 0,
      stiffness: 1500,
      damping: 77.46,
      mass: 1,
      restDisplacementThreshold: 0.1,
      restSpeedThreshold: 0.1,
      useNativeDriver: false,
    });
    motion.start();
    return () => motion.stop();
  }, [checked, progress, reducedMotion]);
  return (
    <Animated.View
      style={{
        width: 50,
        height: 30,
        borderRadius: 15,
        opacity: disabled ? 0.48 : 1,
        backgroundColor: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [c.switchInactive, c.primary],
        }),
      }}
    >
      <Animated.View
        style={{
          position: 'absolute',
          top: 2,
          left: 0,
          width: 26,
          height: 26,
          borderRadius: 13,
          transform: [
            { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [2.5, 21.5] }) },
          ],
          backgroundColor: progress.interpolate({
            inputRange: [0, 1],
            outputRange: ['#FFFFFF', c.primaryForeground],
          }),
        }}
      />
    </Animated.View>
  );
}

function CheckboxVisual({ checked, disabled = false }: { checked: boolean; disabled?: boolean }) {
  const c = useBUITheme();
  return (
    <YStack p={3}>
      <YStack
        width={22}
        height={22}
        rounded={6}
        borderWidth={checked ? 0 : 2}
        borderColor={c.iconTertiary}
        bg={checked ? c.primary : 'transparent'}
        opacity={disabled ? 0.48 : 1}
        items="center"
        justify="center"
      >
        {checked && <Check size={16} strokeWidth={3} color={c.primaryForeground} />}
      </YStack>
    </YStack>
  );
}

function RadioVisual({ checked, disabled = false }: { checked: boolean; disabled?: boolean }) {
  const c = useBUITheme();
  const color = disabled ? c.text : checked ? c.primary : c.iconSecondary;
  return (
    <YStack p={2}>
      <YStack
        width={20}
        height={20}
        rounded={10}
        borderWidth={2}
        borderColor={color}
        opacity={disabled ? 0.38 : 1}
        items="center"
        justify="center"
      >
        {checked && <YStack width={10} height={10} rounded={5} bg={color} />}
      </YStack>
    </YStack>
  );
}

function SelectionControl({
  kind,
  checked,
  label,
  onCheckedChange,
  disabled = false,
}: BUISelectionProps & { kind: BUISelectionKind }) {
  const Visual =
    kind === 'switch' ? SwitchVisual : kind === 'checkbox' ? CheckboxVisual : RadioVisual;
  return (
    <AppPressable
      accessibilityRole={kind}
      accessibilityLabel={label}
      accessibilityState={{ checked, disabled: disabled || !onCheckedChange }}
      disabled={disabled || !onCheckedChange}
      minHeight={48}
      minWidth={kind === 'switch' ? 50 : 48}
      items="center"
      justify="center"
      pressStyle={{ opacity: 1 }}
      onPress={() => {
        if (!disabled) onCheckedChange?.(kind === 'radio' ? true : !checked);
      }}
    >
      <Visual checked={checked} disabled={disabled} />
    </AppPressable>
  );
}

export function BUISwitch(props: BUISelectionProps) {
  return <SelectionControl {...props} kind="switch" />;
}
export { SwitchVisual as BUISwitchVisual };
export function BUICheckbox(props: BUISelectionProps) {
  return <SelectionControl {...props} kind="checkbox" />;
}
export function BUIRadio(props: BUISelectionProps) {
  return <SelectionControl {...props} kind="radio" />;
}

export function BUISelectionRow({
  kind,
  checked,
  label,
  description,
  onCheckedChange,
  disabled = false,
  onInfo,
}: BUISelectionProps & { kind: BUISelectionKind; description?: string; onInfo?: () => void }) {
  const c = useBUITheme();
  const Visual =
    kind === 'switch' ? SwitchVisual : kind === 'checkbox' ? CheckboxVisual : RadioVisual;
  const visual = <Visual checked={checked} disabled={disabled} />;
  return (
    <XStack items="center">
      <AppPressable
        flex={1}
        minHeight={48}
        px={16}
        py={kind === 'checkbox' ? 12 : 8}
        flexDirection="row"
        items="center"
        gap={8}
        accessibilityRole={kind}
        accessibilityLabel={label}
        accessibilityHint={description}
        accessibilityState={{ checked, disabled: disabled || !onCheckedChange }}
        disabled={disabled || !onCheckedChange}
        onPress={() => {
          if (!disabled) onCheckedChange?.(kind === 'radio' ? true : !checked);
        }}
      >
        {kind !== 'switch' && visual}
        <YStack flex={1} gap={2}>
          <BUIText
            kind="body1"
            color={disabled ? c.tertiaryText : kind === 'checkbox' ? c.muted : c.text}
          >
            {label}
          </BUIText>
          {description && (
            <BUIText kind="body2" color={c.muted}>
              {description}
            </BUIText>
          )}
        </YStack>
        {kind === 'switch' && visual}
      </AppPressable>
      {onInfo && (
        <AppPressable
          accessibilityLabel={`About ${label}`}
          minWidth={48}
          minHeight={48}
          items="center"
          justify="center"
          onPress={onInfo}
        >
          <Info size={16} color={c.iconTertiary} />
        </AppPressable>
      )}
    </XStack>
  );
}
