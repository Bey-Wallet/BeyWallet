import React, { useState } from 'react';
import { ChevronRight, Wallet } from '@tamagui/lucide-icons';
import { XStack, YStack } from 'tamagui';
import { AppPressable } from '~/shared/ui/AppPressable';
import { appTypography } from '~/shared/theme/appearance';
import { BUIPage, BUISection, BUIText } from '~/shared/ui/BUI/BUIPage';
import { BUIButton } from '~/shared/ui/BUI/BUIButton';
import { useBUITheme } from '~/shared/ui/BUI/useBUITheme';
import { useBUIStore } from '~/state/buiStore';

export function NewUiColorsScreen() {
  const appearance = useBUIStore((state) => state.appearance);
  const c = useBUITheme(appearance);
  const [presses, setPresses] = useState(0);
  const swatches = (items: readonly (readonly [string, string])[]) => (
    <YStack mx={16} rounded="$6" bg={c.surface} overflow="hidden">
      {items.map(([name, color], index) => (
        <YStack key={name}>
          {index > 0 && <YStack height={2} bg={c.canvas} />}
          <XStack px={16} py={12} gap={12} items="center">
            <YStack
              width={36}
              height={36}
              rounded={8}
              bg={color}
              borderWidth={1}
              borderColor={c.separator}
              accessible
              accessibilityLabel={`${name}, ${color}`}
            />
            <YStack flex={1} gap={4}>
              <BUIText>{name}</BUIText>
              <BUIText kind="body2" color={c.muted}>
                {color}
              </BUIText>
            </YStack>
          </XStack>
        </YStack>
      ))}
    </YStack>
  );
  return (
    <BUIPage
      title="BUI / Theme & colors"
      status={`Pure ${appearance === 'light' ? 'white' : 'black'} background. Cards and nested surfaces use relative neutral shades. Preview actions: ${presses}.`}
    >
      <BUISection
        name="Surfaces"
        measurement="The page is the base. Cards use one neutral level, nested surfaces another, and pressed surfaces a stronger level."
      >
        {swatches([
          ['Page background', c.canvas],
          ['Card / grouped list', c.surface],
          ['Raised / nested surface', c.raised],
          ['Pressed surface', c.pressed],
          ['Input field', c.field],
          ['Separator / border', c.separator],
        ])}
      </BUISection>
      <BUISection name="A card in context">
        <YStack mx={16} p={16} gap={16} rounded="$6" bg={c.surface}>
          <XStack gap={12} items="center">
            <YStack
              width={44}
              height={44}
              rounded={22}
              bg={c.raised}
              items="center"
              justify="center"
            >
              <Wallet size={22} color={c.icon} />
            </YStack>
            <YStack flex={1} gap={4}>
              <BUIText>My wallet</BUIText>
              <BUIText kind="body2" color={c.muted}>
                A neutral card on the page background
              </BUIText>
            </YStack>
          </XStack>
          <BUIText {...appTypography.amountSmall}>24,500 sats</BUIText>
          <YStack p={12} rounded={12} bg={c.raised} gap={4}>
            <BUIText>Nested surface</BUIText>
            <BUIText kind="body2" color={c.muted}>
              A different shade from the card around it.
            </BUIText>
          </YStack>
          <BUIButton
            appearance={appearance}
            size="large"
            fullWidth
            onPress={() => setPresses((count) => count + 1)}
          >
            Continue
          </BUIButton>
        </YStack>
        <AppPressable
          mx={16}
          p={16}
          minHeight={56}
          rounded="$6"
          bg={c.surface}
          flexDirection="row"
          items="center"
          gap={12}
          pressStyle={{ bg: c.pressed }}
          onPress={() => setPresses((count) => count + 1)}
          accessibilityLabel="Try the pressed surface"
        >
          <BUIText flex={1}>Press to compare the surface</BUIText>
          <ChevronRight size={20} color={c.muted} />
        </AppPressable>
      </BUISection>
      <BUISection name="Text & icons">
        {swatches([
          ['Primary text', c.text],
          ['Secondary text', c.secondaryText],
          ['Tertiary / disabled decoration', c.tertiaryText],
          ['Primary icon', c.icon],
        ])}
        <YStack px={16} gap={8}>
          <BUIText>Primary information</BUIText>
          <BUIText color={c.secondaryText}>Descriptions and secondary values</BUIText>
          <BUIText kind="body2" color={c.muted}>
            Tertiary color is reserved for decoration and disabled content.
          </BUIText>
        </YStack>
      </BUISection>
      <BUISection name="Primary & semantic colors">
        {swatches([
          ['Primary', c.primary],
          ['Text on primary', c.primaryForeground],
          ['Primary pressed', c.primaryPressed],
          ['Primary disabled', c.primaryDisabled],
          ['Success', c.positive],
          ['Error', c.negative],
          ['Warning', c.warning],
          ['Error field tint', c.fieldError],
        ])}
      </BUISection>
      <BUISection name="Overlays">
        <YStack mx={16} p={16} gap={12} rounded="$6" bg={c.raised}>
          <BUIText>Background surface</BUIText>
          <YStack p={16} rounded={12} bg={c.overlayLight}>
            <BUIText color="#FFFFFF">Overlay over a surface</BUIText>
          </YStack>
        </YStack>
        {swatches([
          ['Strong overlay', c.overlayStrong],
          ['Medium overlay', c.overlayLight],
          ['Light overlay', c.overlayExtraLight],
        ])}
      </BUISection>
    </BUIPage>
  );
}
