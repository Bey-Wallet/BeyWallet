import React, { useState } from 'react';
import { ArrowDown, ArrowRightLeft, ArrowUp, ScanLine } from '@tamagui/lucide-icons';
import { XStack, YStack } from 'tamagui';
import { BUISwitch } from '~/shared/ui/BUI/BUISelectionControl';
import {
  BUIChoices as ReferenceChoices,
  BUIPage as ReferencePage,
  BUISection as ReferenceSpec,
  BUIText as ReferenceText,
} from '~/shared/ui/BUI/BUIPage';
import { BUIActionButton } from '~/shared/ui/BUI/BUIButton';
import {
  buiButtonSizes as referenceSizes,
  buiButtonVariants as referenceVariants,
  type BUIButtonSize as ReferenceSize,
  type BUIButtonState as ReferenceState,
} from '~/shared/ui/BUI/theme';
import { useBUITheme } from '~/shared/ui/BUI/useBUITheme';
import { BUIButton } from '~/shared/ui/BUI/BUIButton';
import { useBUIStore } from '~/state/buiStore';

export function BUIButtonsScreen() {
  const appearance = useBUIStore((state) => state.appearance);
  const [fullWidth, setFullWidth] = useState(false);
  const [size, setSize] = useState<ReferenceSize>('large');
  const [state, setState] = useState<ReferenceState>('Default');
  const [content, setContent] = useState<'Label' | 'Icon + label'>('Label');
  const [presses, setPresses] = useState(0);
  const press = () => setPresses((count) => count + 1);
  const theme = useBUITheme(appearance);
  const common = {
    appearance,
    fullWidth,
    state,
    icon: content === 'Icon + label',
    onPress: press,
  };
  return (
    <ReferencePage
      title="BUI / Buttons"
      status={`Preview presses: ${presses}. Changes here apply only to this playground.`}
      controls={
        <YStack gap={12}>
          <XStack items="center" gap={12}>
            <BUISwitch
              checked={fullWidth}
              onCheckedChange={setFullWidth}
              label="Full width buttons"
            />
            <YStack flex={1} gap={4}>
              <ReferenceText kind="label1">Full width</ReferenceText>
              <ReferenceText kind="body2" color={theme.muted}>
                {fullWidth ? 'Fill the available width' : 'Fit the button label and padding'}
              </ReferenceText>
            </YStack>
          </XStack>
          <ReferenceChoices
            values={['small', 'medium', 'large'] as const}
            value={size}
            onChange={setSize}
          />
          <ReferenceChoices
            values={['Default', 'Highlighted', 'Disabled', 'Loading'] as const}
            value={state}
            onChange={setState}
          />
          <ReferenceChoices
            values={['Label', 'Icon + label'] as const}
            value={content}
            onChange={setContent}
          />
        </YStack>
      }
    >
      <ReferenceSpec
        name="Size scale"
        measurement="Small H36 / R18 / 14 sp; medium H48 / R24 / 16 sp; large H56 / R16 / 16 sp. Weight500, tracking0.005 em, horizontal16 / vertical8, proportional icons16/20/24 / gap8, matching loaders. Small specimens keep a48-point touch area. Inter substitutes the source font; native line metrics/ripple differ."
      >
        <YStack px={16} gap={16}>
          {(['small', 'medium', 'large'] as const).map((item) => (
            <YStack key={item} gap={6}>
              <ReferenceText kind="body2" color={theme.muted}>
                {item} · H{referenceSizes[item].height} · R{referenceSizes[item].radius} ·{' '}
                {referenceSizes[item].fontSize} sp
              </ReferenceText>
              <BUIButton {...common} size={item}>
                Continue
              </BUIButton>
            </YStack>
          ))}
        </YStack>
      </ReferenceSpec>
      <ReferenceSpec
        name="Button variants"
        measurement="Primary is black in light mode and white in dark mode, with inverse text. Accent is Obsidian purple with white text. Secondary is filled neutral grey. Tertiary is transparent with primary text and a subtle pressed fill. Green, Orange and Red keep their semantic colors. Loading blocks taps. Highlighted shows the pressed color."
      >
        <YStack px={16} gap={16}>
          {referenceVariants.map((variant) => (
            <BUIButton key={variant} {...common} size={size} variant={variant}>
              {variant}
            </BUIButton>
          ))}
        </YStack>
      </ReferenceSpec>
      <ReferenceSpec
        name="Text buttons"
        measurement="All three sizes and radii. Text buttons use the page foreground and have no icon/loading variant. Loading selection shows their default presentation."
      >
        <YStack px={16} gap={12}>
          {(['small', 'medium', 'large'] as const).map((item) => (
            <BUIButton
              {...common}
              key={item}
              size={item}
              textOnly
              icon={false}
              state={state === 'Loading' ? 'Default' : state}
            >
              Text button
            </BUIButton>
          ))}
        </YStack>
      </ReferenceSpec>
      <ReferenceSpec
        name="Home action buttons"
        measurement="Layout76 × 84, circle56, icon16, label12 Medium/gap8. Plain actions: icon28, label gap4. These retain their own fixed geometry and remain interactive independently of the labeled-button state and width controls."
      >
        <XStack px={16} flexWrap="wrap" justify="space-around">
          {[
            { title: 'Receive', Icon: ArrowDown },
            { title: 'Send', Icon: ArrowUp },
            { title: 'Transfer', Icon: ArrowRightLeft },
            { title: 'Scan', Icon: ScanLine },
          ].map(({ title, Icon }) => (
            <BUIActionButton key={title} appearance={appearance} title={title} onPress={press}>
              <Icon size={16} color={theme.buttons.Secondary[3]} />
            </BUIActionButton>
          ))}
        </XStack>
        <XStack px={16} justify="space-around">
          {[
            { title: 'Receive', Icon: ArrowDown },
            { title: 'Send', Icon: ArrowUp },
          ].map(({ title, Icon }) => (
            <BUIActionButton
              key={title}
              appearance={appearance}
              title={title}
              plain
              onPress={press}
            >
              <Icon size={28} color={theme.buttons.Secondary[3]} />
            </BUIActionButton>
          ))}
        </XStack>
      </ReferenceSpec>
    </ReferencePage>
  );
}
