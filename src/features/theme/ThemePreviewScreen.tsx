import React, { useState } from 'react';
import { Redirect, Stack, useRouter } from 'expo-router';
import { Platform, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Theme, XStack, YStack, Input } from 'tamagui';
import { ArrowUp, ArrowDown, ArrowRightLeft, X, Check } from '@tamagui/lucide-icons';
import { useAppTheme } from '~/shared/theme/ThemeContext';
import {
  beyColors,
  beyDimensions,
  beyRadii,
  beySpacing,
  beyThemeNames,
  beyTypography,
  type BeyColorRole,
  type BeyThemeMode,
  type BeyTextVariant,
} from '~/shared/theme/bey';
import { AppPressable } from '~/shared/ui/AppPressable';
import { BeyText } from '~/shared/ui/BeyText';
import { Spinner } from '~/shared/ui/Spinner';
import { getBeyTypographyProps } from '~/shared/theme/bey/typography';

type ButtonKind = 'Primary' | 'Secondary' | 'Tertiary' | 'Green' | 'Orange' | 'Red';
type ButtonState = 'normal' | 'highlighted' | 'disabled' | 'loading';

function PreviewButton({
  kind,
  state,
  mode,
}: {
  kind: ButtonKind;
  state: ButtonState;
  mode: BeyThemeMode;
}) {
  const colors = beyColors[mode];
  const suffix = state === 'disabled' ? 'Disabled' : state === 'highlighted' ? 'Highlighted' : '';
  const background = colors[`button${kind}Background${suffix}`];
  const foreground = colors[`button${kind}Foreground`];
  const [pressedCount, setPressedCount] = useState(0);
  return (
    <AppPressable
      minHeight={beyDimensions.item}
      rounded="$beyMedium"
      px={16}
      bg={background}
      items="center"
      justify="center"
      flex={1}
      accessibilityLabel={`${kind} ${state}`}
      disabled={state === 'disabled' || state === 'loading'}
      accessibilityState={{ busy: state === 'loading' }}
      hoverStyle={{ bg: colors[`button${kind}BackgroundHighlighted`] }}
      pressStyle={{ bg: colors[`button${kind}BackgroundHighlighted`] }}
      onPress={() => setPressedCount((count) => count + 1)}
    >
      {state === 'loading' ? (
        <Spinner size="small" color={foreground} />
      ) : (
        <BeyText variant="label1" color={foreground} text="center">
          {pressedCount
            ? `Tapped ${pressedCount}`
            : state === 'normal'
              ? kind
              : state === 'highlighted'
                ? 'Highlighted'
                : 'Disabled'}
        </BeyText>
      )}
    </AppPressable>
  );
}

function PreviewField({ mode, error = false }: { mode: BeyThemeMode; error?: boolean }) {
  const colors = beyColors[mode];
  const [focused, setFocused] = useState(false);
  return (
    <YStack gap={4}>
      <BeyText variant="label2" tone={error ? 'accentRed' : 'textSecondary'}>
        {error ? 'Invalid amount' : 'Payment note'}
      </BeyText>
      <Input
        unstyled
        {...getBeyTypographyProps('body1', Platform.OS === 'web')}
        color={colors.textPrimary}
        bg={error ? colors.fieldErrorBackground : colors.fieldBackground}
        rounded="$beyMedium"
        borderWidth={1}
        borderColor={
          error ? colors.fieldErrorBorder : focused ? colors.fieldActiveBorder : 'transparent'
        }
        minHeight={beyDimensions.item}
        px={16}
        py={12}
        defaultValue={error ? 'Demo error' : 'Lunch with a friend'}
        accessibilityLabel={error ? 'Preview error field' : 'Preview payment note'}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      {error && (
        <BeyText variant="body3" tone="accentRed">
          Enter a valid amount.
        </BeyText>
      )}
    </YStack>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <YStack gap={beySpacing.medium}>
      <BeyText variant="h3" accessibilityRole="header">
        {title}
      </BeyText>
      {children}
    </YStack>
  );
}

function PreviewContent({
  mode,
  onModeChange,
}: {
  mode: BeyThemeMode;
  onModeChange: (mode: BeyThemeMode) => void;
}) {
  const colors = beyColors[mode];
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <YStack flex={1} bg="$beyBackgroundPage" pt={insets.top}>
      <XStack px={16} py={12} items="center" gap={12}>
        <YStack flex={1}>
          <BeyText variant="h2" accessibilityRole="header">
            Theme preview
          </BeyText>
          <BeyText variant="body2" tone="textSecondary">
            Bey Wallet · Tonkeeper foundation
          </BeyText>
        </YStack>
        <AppPressable
          width={48}
          minHeight={48}
          rounded={24}
          bg="$beyBackgroundContentTint"
          items="center"
          justify="center"
          accessibilityLabel="Close theme preview"
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace('/(tabs)/settings/about')
          }
        >
          <X size={24} color={colors.iconPrimary} />
        </AppPressable>
      </XStack>
      <XStack px={16} pb={16} gap={12}>
        {(['dark', 'light'] as const).map((appearance) => (
          <AppPressable
            key={appearance}
            flex={1}
            minHeight={48}
            rounded="$beyMedium"
            flexDirection="row"
            gap={8}
            items="center"
            justify="center"
            accessibilityRole="radio"
            accessibilityLabel={`${appearance === 'dark' ? 'Dark' : 'Light'} preview`}
            accessibilityState={{ checked: mode === appearance }}
            bg={mode === appearance ? '$beyBackgroundContentAttention' : '$beyBackgroundContent'}
            onPress={() => onModeChange(appearance)}
          >
            {mode === appearance && <Check size={20} color={colors.iconPrimary} />}
            <BeyText variant="label1">{appearance === 'dark' ? 'Dark' : 'Light'}</BeyText>
          </AppPressable>
        ))}
      </XStack>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: Math.max(insets.bottom, 16) + 16,
          gap: 32,
        }}
      >
        <BeyText variant="body2" tone="textSecondary">
          Preview changes stay here. All payments and balances below are examples.
        </BeyText>
        <Section title="Everyday surfaces">
          <YStack rounded="$beyLarge" bg="$beyBackgroundContent" p={16} gap={4}>
            <BeyText variant="body2" tone="textSecondary">
              Example balance
            </BeyText>
            <BeyText variant="num1">128,450 sat</BeyText>
            <BeyText variant="body2" tone="accentGreen">
              +2,400 sat today
            </BeyText>
          </YStack>
          <YStack gap={12}>
            {(
              [
                ['Sent', 'Ecash · Sample mint', '− 1,200 sat', ArrowUp],
                ['Received', 'Lightning', '+ 2,400 sat', ArrowDown],
                ['Transfer', 'Between mints', '500 sat', ArrowRightLeft],
              ] as const
            ).map(([title, subtitle, amount, Icon]) => (
              <XStack
                key={title}
                p={16}
                minHeight={80}
                rounded="$beyMedium"
                bg="$beyBackgroundContent"
                gap={12}
                items="center"
              >
                <XStack
                  width={44}
                  height={44}
                  rounded={22}
                  bg="$beyBackgroundContentTint"
                  items="center"
                  justify="center"
                >
                  <Icon size={22} color={colors.iconSecondary} />
                </XStack>
                <YStack flex={1} minWidth={0}>
                  <BeyText variant="label1">{title}</BeyText>
                  <BeyText variant="body2" tone="textSecondary">
                    {subtitle}
                  </BeyText>
                </YStack>
                <YStack items="flex-end">
                  <BeyText variant="label1">{amount}</BeyText>
                  <BeyText variant="body2" tone="textSecondary">
                    12:45
                  </BeyText>
                </YStack>
              </XStack>
            ))}
          </YStack>
        </Section>
        <Section title="Typography">
          {(Object.keys(beyTypography) as BeyTextVariant[]).map((variant) => (
            <YStack key={variant} gap={4}>
              <BeyText variant="body3" tone="textSecondary">
                {variant} · {beyTypography[variant].fontSize} pt
              </BeyText>
              <BeyText variant={variant} testID={`preview-type-${variant}`}>
                {variant.startsWith('num')
                  ? '128,450.09'
                  : variant === 'mono'
                    ? 'bey:demo:1234567890'
                    : variant === 'body4CAPS'
                      ? 'PAYMENT RECEIVED'
                      : 'Make every payment feel simple.'}
              </BeyText>
            </YStack>
          ))}
        </Section>
        <Section title="Buttons and states">
          {(['Primary', 'Secondary', 'Tertiary', 'Green', 'Orange', 'Red'] as const).map((kind) => (
            <YStack key={kind} gap={12}>
              <XStack gap={12}>
                <PreviewButton kind={kind} state="normal" mode={mode} />
                <PreviewButton kind={kind} state="highlighted" mode={mode} />
              </XStack>
              <XStack gap={12}>
                <PreviewButton kind={kind} state="disabled" mode={mode} />
                <PreviewButton kind={kind} state="loading" mode={mode} />
              </XStack>
            </YStack>
          ))}
        </Section>
        <Section title="Fields">
          <PreviewField mode={mode} />
          <PreviewField mode={mode} error />
        </Section>
        <Section title="Radii">
          <XStack flexWrap="wrap" gap={12}>
            {Object.entries(beyRadii).map(([name, radius]) => (
              <YStack
                key={name}
                width={96}
                minHeight={80}
                rounded={radius}
                bg="$beyBackgroundContentTint"
                items="center"
                justify="center"
              >
                <BeyText variant="label2">{name}</BeyText>
                <BeyText variant="body3" tone="textSecondary">
                  {radius === 999 ? 'Pill / circle' : `${radius} pt`}
                </BeyText>
              </YStack>
            ))}
          </XStack>
        </Section>
        <Section title="Existing spinner">
          <XStack items="center" gap={32}>
            <YStack gap={12} items="center">
              <Spinner size="large" color={colors.accentBlue} />
              <BeyText variant="body3" tone="textSecondary">
                System motion preference
              </BeyText>
            </YStack>
            <YStack gap={12} items="center">
              <Spinner size="large" color={colors.accentBlue} reduceMotion />
              <BeyText variant="body3" tone="textSecondary">
                Reduced motion
              </BeyText>
            </YStack>
          </XStack>
        </Section>
        <Section title="Color roles">
          {(Object.entries(colors) as [BeyColorRole, string][]).map(([role, value]) => (
            <XStack key={role} items="center" gap={12} minHeight={48}>
              <YStack
                width={36}
                height={36}
                rounded="$beyXs"
                bg={value}
                borderWidth={1}
                borderColor="$beySeparatorCommon"
              />
              <YStack flex={1} minWidth={0}>
                <BeyText variant="label2">{role}</BeyText>
                <BeyText variant="body3" tone="textSecondary">
                  {value}
                </BeyText>
              </YStack>
            </XStack>
          ))}
        </Section>
      </ScrollView>
    </YStack>
  );
}

function ThemePreview() {
  const { resolvedTheme } = useAppTheme();
  const [mode, setMode] = useState<BeyThemeMode>(resolvedTheme);
  return (
    <Theme name={beyThemeNames[mode]}>
      <Stack.Screen options={{ headerShown: false, presentation: 'fullScreenModal' }} />
      <PreviewContent mode={mode} onModeChange={setMode} />
    </Theme>
  );
}

export function ThemePreviewScreen() {
  if (!__DEV__) return <Redirect href="/(tabs)/settings/about" />;
  return <ThemePreview />;
}
