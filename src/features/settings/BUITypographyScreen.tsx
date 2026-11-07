import { useBUITheme } from '~/shared/ui/BUI/useBUITheme';
import React, { useState } from 'react';
import { YStack } from 'tamagui';
import {
  BUIChoices,
  BUIPage,
  BUISection,
  BUIText,
  buiTypography,
  type BUITypeRole,
} from '~/shared/ui/BUI';

const samples: Record<BUITypeRole, string> = {
  num1: '12,345.67',
  num2: '24,500 sats',
  h1: 'Your wallet',
  h2: 'Ready to receive',
  h3: 'Wallet details',
  label1: 'Send and receive',
  label2: 'Choose a wallet',
  label3: 'Updated just now',
  body1: 'Keep your wallet available on the devices you use every day.',
  body2: 'Check the amount and recipient before continuing.',
  body3: 'A short supporting description',
  body4CAPS: 'NETWORK · CONFIRMED',
  mono: 'SAMPLE_0123456789_ABCDEF',
};

export function BUITypographyScreen() {
  const c = useBUITheme();
  const [category, setCategory] = useState<'Type scale' | 'Reading' | 'Numbers'>('Type scale');
  const [scale, setScale] = useState<'100%' | '130%' | '200%'>('100%');
  const factor = parseInt(scale, 10) / 100;
  const sample = (role: BUITypeRole, text: string, muted = false, lines?: number) => {
    const token = buiTypography[role];
    return (
      <BUIText
        kind={role}
        fontSize={token.fontSize * factor}
        lineHeight={'lineHeight' in token ? token.lineHeight * factor : undefined}
        letterSpacing={token.letterSpacing * factor}
        color={muted ? c.muted : c.text}
        numberOfLines={lines}
        ellipsizeMode="tail"
      >
        {text}
      </BUIText>
    );
  };
  return (
    <BUIPage
      title="BUI / Typography"
      status={`Preview scale ${scale}, in addition to system text scaling. Inter Text/Display retain the registered fonts and numeric features. Heading weight700 maps to600; the mono role uses tabular Inter rather than a new font.`}
      controls={
        <YStack gap={12}>
          <BUIChoices
            values={['Type scale', 'Reading', 'Numbers'] as const}
            value={category}
            onChange={setCategory}
          />
          <BUIChoices
            values={['100%', '130%', '200%'] as const}
            value={scale}
            onChange={setScale}
          />
        </YStack>
      }
    >
      {category === 'Type scale' &&
        (Object.keys(buiTypography) as BUITypeRole[]).map((role) => {
          const token = buiTypography[role];
          return (
            <BUISection
              key={role}
              name={role}
              measurement={`${token.fontSize} sp · weight${token.fontWeight} · tracking${token.letterSpacing} · line height ${'lineHeight' in token ? token.lineHeight : 'natural'}`}
            >
              <YStack px={16}>{sample(role, samples[role])}</YStack>
            </BUISection>
          );
        })}
      {category === 'Reading' && (
        <>
          <BUISection
            name="Hierarchy & wrapping"
            measurement="H2 24/32; Body1 16/24; Body2 14/20. This sample composition uses16-point padding and12-point gaps."
          >
            <YStack mx={16} p={16} gap={12} rounded={20} bg={c.surface}>
              {sample('h2', 'A wallet for everyday use')}
              {sample(
                'body1',
                'Receive funds, check your balance and review each payment before continuing. Longer text wraps naturally without a fixed-height container.',
              )}
              {sample(
                'body2',
                'Descriptions support the action without competing with the balance.',
                true,
              )}
            </YStack>
          </BUISection>
          <BUISection
            name="Long labels & identifiers"
            measurement="Single-line labels ellipsize; descriptions wrap. The identifier is synthetic."
          >
            <YStack px={16} gap={16}>
              {sample(
                'label1',
                'A very long wallet name that must yield space on a narrow screen',
                false,
                1,
              )}
              {sample('body2', 'SAMPLE_ONLY_0123456789_ABCDEFGHIJKLMNOPQRSTUVWXYZ_0123456789')}
            </YStack>
          </BUISection>
        </>
      )}
      {category === 'Numbers' && (
        <>
          <BUISection
            name="Number styles"
            measurement="num1 32 Medium; num2 28 Medium; default tracking. All font roles keep tabular digits and the unslashed zero."
          >
            <YStack px={16} gap={12}>
              {['0.00', '1,111.11', '8,888.88', '12,345,678.90'].map((value) => (
                <YStack key={value}>{sample('num1', value)}</YStack>
              ))}
              {sample('num2', '24,500 sats')}
              {sample('body2', '≈ $24.50 · sample value', true)}
            </YStack>
          </BUISection>
          <BUISection name="Characters & symbols">
            <YStack px={16} gap={16}>
              {sample('label1', '0 O o · 1 I l · 2 Z · 5 S · 8 B')}
              {sample('body1', '0123456789 · $ € £ ₹ ₿ · . , + − %')}
              {sample('mono', '0123456789 ABCDEF')}
            </YStack>
          </BUISection>
        </>
      )}
    </BUIPage>
  );
}
