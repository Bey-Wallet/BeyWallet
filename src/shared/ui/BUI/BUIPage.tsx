import React from 'react';
import { ScrollView, Theme, XStack, YStack } from 'tamagui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppButton } from '~/shared/ui/AppButton';
import { useBUIStore } from '~/state/buiStore';
import { useBUITheme } from './useBUITheme';
import { BUIText } from './BUIText';
export { BUIText } from './BUIText';

export function BUIChoices<T extends string>({
  values,
  value,
  onChange,
}: {
  values: readonly T[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <XStack gap={8} flexWrap="wrap">
      {values.map((item) => (
        <AppButton
          key={item}
          size="small"
          emphasis={value === item ? 'primary' : 'secondary'}
          accessibilityState={{ selected: value === item }}
          onPress={() => onChange(item)}
        >
          {item[0].toUpperCase() + item.slice(1)}
        </AppButton>
      ))}
    </XStack>
  );
}

export function BUISection({
  name,
  measurement,
  children,
}: {
  name: string;
  measurement?: string;
  children: React.ReactNode;
}) {
  const theme = useBUITheme();
  return (
    <YStack gap={12}>
      <YStack px={16} gap={4}>
        <BUIText kind="h3" accessibilityRole="header">
          {name}
        </BUIText>
        {measurement && (
          <BUIText kind="body2" color={theme.muted}>
            {measurement}
          </BUIText>
        )}
      </YStack>
      {children}
    </YStack>
  );
}

export function BUIPage({
  title,
  status,
  controls,
  children,
}: {
  title: string;
  status?: string;
  controls?: React.ReactNode;
  children: React.ReactNode;
}) {
  const appearance = useBUIStore((state) => state.appearance);
  const setAppearance = useBUIStore((state) => state.setAppearance);
  const theme = useBUITheme(appearance);
  const insets = useSafeAreaInsets();
  return (
    <Theme name={appearance === 'light' ? 'light_bui' : 'dark_bui'}>
      <ScrollView flex={1} bg={theme.canvas} keyboardShouldPersistTaps="handled">
        <YStack gap={32} pt={16} pb={Math.max(insets.bottom, 16) + 16}>
          <YStack px={16} gap={12}>
            <BUIText kind="h2" accessibilityRole="header">
              {title}
            </BUIText>
            <BUIChoices
              values={['light', 'dark'] as const}
              value={appearance}
              onChange={setAppearance}
            />
            {controls}
            {status && (
              <BUIText kind="body2" color={theme.muted} accessibilityLiveRegion="polite">
                {status}
              </BUIText>
            )}
          </YStack>
          {children}
        </YStack>
      </ScrollView>
    </Theme>
  );
}
