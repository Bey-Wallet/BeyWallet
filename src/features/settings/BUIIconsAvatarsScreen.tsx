import React, { useState } from 'react';
import { XStack, YStack } from 'tamagui';
import { BUIPage, BUISection, BUIChoices, BUIText, useBUITheme } from '~/shared/ui/BUI';
import {
  BUIIcon,
  BUICircleIcon,
  BUIIconButton,
  buiIconDefinitions,
  type BUIIconName,
  type BUIIconTone,
} from '~/shared/ui/BUI/BUIIcon';
import { BUIAvatar, BUIAvatarStack, BUIBadgedAvatar } from '~/shared/ui/BUI/BUIAvatar';
import { BUIVerificationBadge } from '~/shared/ui/BUI/BUIBadge';

const artwork = require('~/assets/images/Bitcoin.png');
const names = Object.keys(buiIconDefinitions) as BUIIconName[];

export function BUIIconsAvatarsScreen() {
  const c = useBUITheme();
  const [category, setCategory] = useState<'Icons' | 'Avatars'>('Icons');
  const [tone, setTone] = useState<BUIIconTone>('primary');
  const [iconSize, setIconSize] = useState<'Original' | '16' | '20' | '28'>('Original');
  const [size, setSize] = useState<'36' | '44' | '56'>('36');
  const [shape, setShape] = useState<'Circle' | 'Rounded'>('Circle');
  const [state, setState] = useState<'Loaded' | 'Loading' | 'Initials' | 'Empty error'>('Loaded');
  const [overlap, setOverlap] = useState<'EndOnTop' | 'StartOnTop'>('EndOnTop');
  const [presses, setPresses] = useState(0);
  return (
    <BUIPage
      title="BUI / Icons & avatars"
      status={`Preview presses: ${presses}. Existing Lucide icons use BUI tints. Image examples use local sample artwork.`}
      controls={
        <BUIChoices
          values={['Icons', 'Avatars'] as const}
          value={category}
          onChange={setCategory}
        />
      }
    >
      {category === 'Icons' && (
        <>
          <BUISection
            name="Icon family"
            measurement="Existing Lucide glyphs, default sizes16/28 and stroke1.8. Original uses each slot's default size; back and navigation cues mirror in RTL."
          >
            <YStack px={16} gap={12}>
              <BUIChoices
                values={['Original', '16', '20', '28'] as const}
                value={iconSize}
                onChange={setIconSize}
              />
              <BUIChoices
                values={
                  [
                    'primary',
                    'secondary',
                    'tertiary',
                    'accent',
                    'success',
                    'warning',
                    'error',
                  ] as const
                }
                value={tone}
                onChange={setTone}
              />
              <XStack gap={12} flexWrap="wrap">
                {names.map((name) => (
                  <YStack
                    key={name}
                    width={88}
                    minHeight={88}
                    p={8}
                    gap={8}
                    rounded={12}
                    bg={c.surface}
                    items="center"
                    justify="center"
                  >
                    <BUIIcon
                      name={name}
                      size={iconSize === 'Original' ? undefined : Number(iconSize)}
                      tone={tone}
                      label={name}
                    />
                    <BUIText kind="body3" textAlign="center">
                      {name}
                    </BUIText>
                  </YStack>
                ))}
              </XStack>
            </YStack>
          </BUISection>
          <BUISection
            name="Circle icons"
            measurement="Default36 circle / glyph20 / attention surface / secondary tint. Caller-sized44 / glyph28 shown alongside it."
          >
            <XStack px={16} gap={24} items="center">
              <BUICircleIcon name="wallet" />
              <BUICircleIcon name="wallet" size={44} iconSize={28} />
              <BUICircleIcon name="checkCircle" tone="success" />
            </XStack>
          </BUISection>
          <BUISection
            name="Action icons"
            measurement="Visual circle32 / glyph16. The surrounding interactive target remains48. Disabled controls block taps."
          >
            <XStack px={16} gap={12} flexWrap="wrap">
              {(['back', 'close', 'plus', 'check'] as const).map((name) => (
                <BUIIconButton
                  key={name}
                  name={name}
                  label={`Sample ${name}`}
                  onPress={() => setPresses((count) => count + 1)}
                />
              ))}
              <BUIIconButton
                name="close"
                label="Disabled sample close"
                disabled
                onPress={() => setPresses((count) => count + 1)}
              />
            </XStack>
          </BUISection>
        </>
      )}
      {category === 'Avatars' && (
        <>
          <BUISection
            name="Image, loading and fallback"
            measurement="Default36;44 and56 are common image sizes. Circular clipping and center crop; optional caller-rounded shape. Image crossfade240 ms follows reduced motion. Initials fallback:1-point outline / text10; empty failure keeps the loading surface."
          >
            <YStack px={16} gap={12}>
              <BUIChoices values={['36', '44', '56'] as const} value={size} onChange={setSize} />
              <BUIChoices
                values={['Circle', 'Rounded'] as const}
                value={shape}
                onChange={setShape}
              />
              <BUIChoices
                values={['Loaded', 'Loading', 'Initials', 'Empty error'] as const}
                value={state}
                onChange={setState}
              />
              <BUIAvatar
                source={artwork}
                size={Number(size)}
                shape={shape === 'Circle' ? 'circle' : 'rounded'}
                presentation={
                  state === 'Loaded' ? 'auto' : state === 'Loading' ? 'loading' : 'error'
                }
                initials={state === 'Empty error' ? '' : 'BW'}
                label={`Sample avatar, ${state}`}
              />
            </YStack>
          </BUISection>
          <BUISection
            name="Size scale"
            measurement="Default36, account44 and shelf56. Artwork keeps its own colors."
          >
            <XStack px={16} gap={24} items="center">
              {[36, 44, 56].map((value) => (
                <YStack key={value} gap={8} items="center">
                  <BUIAvatar source={artwork} size={value} label={`Sample image ${value}`} />
                  <BUIText kind="body3">{value}</BUIText>
                </YStack>
              ))}
            </XStack>
          </BUISection>
          <BUISection
            name="Avatar in a row"
            measurement="Row minimum56, leading36, padding16 × 8, image gap16, text gap2 and trailing gap8."
          >
            <XStack
              mx={16}
              minHeight={56}
              px={16}
              py={8}
              rounded={20}
              bg={c.surface}
              items="center"
            >
              <YStack mr={16}>
                <BUIAvatar source={artwork} label="Sample wallet avatar" />
              </YStack>
              <YStack flex={1} gap={2}>
                <BUIText>Sample wallet</BUIText>
                <BUIText kind="body2" color={c.muted}>
                  Local artwork
                </BUIText>
              </YStack>
              <YStack ml={8}>
                <BUIVerificationBadge />
              </YStack>
            </XStack>
          </BUISection>
          <BUISection
            name="Badged image"
            measurement="Content44 / badge20; circular diagonal anchor at bottom-end and a true2-point transparent cutout."
          >
            <YStack px={16} py={8}>
              <BUIBadgedAvatar
                source={artwork}
                size={44}
                label="Sample image with badge"
                badge={
                  <YStack
                    width={20}
                    height={20}
                    rounded={10}
                    bg={c.primary}
                    items="center"
                    justify="center"
                  >
                    <BUIIcon name="check" size={12} color={c.primaryForeground} />
                  </YStack>
                }
              />
            </YStack>
          </BUISection>
          <BUISection
            name="Overlapping avatars"
            measurement="Overlap4, cut padding2. The covered avatar has a transparent circular cutout; stacking order is selectable."
          >
            <YStack px={16} gap={16}>
              <BUIChoices
                values={['EndOnTop', 'StartOnTop'] as const}
                value={overlap}
                onChange={setOverlap}
              />
              <BUIAvatarStack
                direction={overlap}
                avatars={[
                  { source: artwork, label: 'First sample' },
                  { source: artwork, label: 'Second sample' },
                  { source: artwork, label: 'Third sample' },
                ]}
              />
            </YStack>
          </BUISection>
        </>
      )}
    </BUIPage>
  );
}
