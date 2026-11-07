import React, { useState } from 'react';
import { XStack, YStack } from 'tamagui';
import { BUIPage, BUISection, BUIChoices, BUIText, useBUITheme } from '~/shared/ui/BUI';
import { BUIIcon } from '~/shared/ui/BUI/BUIIcon';
import { BUIBadgedAvatar } from '~/shared/ui/BUI/BUIAvatar';
import {
  BUILabel,
  BUICounter,
  BUIBadgeButton,
  BUIInlineLabel,
  BUIVerificationBadge,
  BUISpamBadge,
  buiBadgeTones,
} from '~/shared/ui/BUI/BUIBadge';
import type { BUIBadgeDirection, BUIBadgeStrategy } from '~/shared/ui/BUI/badgeGeometry';

const artwork = require('~/assets/images/Bitcoin.png');

export function BUIBadgesScreen() {
  const c = useBUITheme();
  const [category, setCategory] = useState<'Labels' | 'Counts & buttons' | 'Overlays'>('Labels');
  const [strategy, setStrategy] = useState<BUIBadgeStrategy>('Circle');
  const [direction, setDirection] = useState<BUIBadgeDirection>('EndBottom');
  const [cutout, setCutout] = useState<'Cutout' | 'Plain'>('Cutout');
  const [badge, setBadge] = useState<'Mark' | 'Count' | 'None'>('Mark');
  const [presses, setPresses] = useState(0);
  return (
    <BUIPage
      title="BUI / Badges"
      status={`Preview presses: ${presses}. All status labels and verification marks are sample presentations.`}
      controls={
        <BUIChoices
          values={['Labels', 'Counts & buttons', 'Overlays'] as const}
          value={category}
          onChange={setCategory}
        />
      }
    >
      {category === 'Labels' && (
        <>
          <BUISection
            name="Labels"
            measurement="H20 / R4 / horizontal5 / top4 / bottom5; uppercase10 Medium, tracking0.1, single-line ellipsis. Neutral uses raised fill; other tones use16% tint of their BUI color."
          >
            <XStack px={16} gap={12} flexWrap="wrap">
              {buiBadgeTones.map((tone) => (
                <BUILabel key={tone} tone={tone}>
                  {tone}
                </BUILabel>
              ))}
            </XStack>
          </BUISection>
          <BUISection
            name="Reserved trailing label"
            measurement="The label keeps its width while the title ellipsizes. Native inline-span baseline behavior is represented by a row layout."
          >
            <YStack mx={16} p={16} rounded={20} bg={c.surface}>
              <BUIInlineLabel
                title="A deliberately long sample wallet name that yields space to the badge"
                badge="Watch only"
              />
            </YStack>
          </BUISection>
          <BUISection
            name="Verification marks"
            measurement="Lucide verification mark: default16, compact12. Tint follows BUI primary."
          >
            <XStack px={16} gap={24} items="center">
              <XStack gap={2} items="center">
                <BUIText kind="body3">Sample asset</BUIText>
                <BUIVerificationBadge size={12} />
              </XStack>
              <XStack gap={8} items="center">
                <BUIText>Sample account</BUIText>
                <BUIVerificationBadge />
              </XStack>
            </XStack>
          </BUISection>
          <BUISection
            name="Spam label"
            measurement="R8 / horizontal8 / vertical4 / Label2 14 Medium / solid BUI warning fill."
          >
            <YStack px={16}>
              <BUISpamBadge />
            </YStack>
          </BUISection>
        </>
      )}
      {category === 'Counts & buttons' && (
        <>
          <BUISection
            name="Count pills"
            measurement="Circular pill, bottom padding1. Width is max(text width + measured text height/4, text height). Body14/line14; no automatic99+ cap. Red uses BUI error rather than a hardcoded red."
          >
            <XStack px={16} gap={20} items="center" flexWrap="wrap">
              {[0, 1, 9, 99, 999, '99+'].map((value) => (
                <BUICounter key={value} count={value} />
              ))}
            </XStack>
          </BUISection>
          <BUISection
            name="Compact & semantic counts"
            measurement="Compact10 SemiBold substitutes the source bold face; line height follows Inter metrics. Empty/null counts are hidden; zero remains visible."
          >
            <XStack px={16} gap={20} items="center">
              <BUICounter count={1} compact />
              <BUICounter count={24} compact tone="primary" />
              <BUICounter count={999} compact tone="success" />
              <BUICounter count={null} />
            </XStack>
          </BUISection>
          <BUISection
            name="Badge buttons"
            measurement="Full pill / raised surface / horizontal16 / vertical8 / content gap6 / Label2 14 Medium. Leading/trailing slots are optional. Interactive variants retain a48-point target."
          >
            <XStack px={16} gap={12} flexWrap="wrap" items="center">
              <BUIBadgeButton>Read only</BUIBadgeButton>
              <BUIBadgeButton leading={<BUIIcon name="check" size={14} />}>Selected</BUIBadgeButton>
              <BUIBadgeButton
                trailing={<BUIIcon name="chevron" size={14} />}
                onPress={() => setPresses((count) => count + 1)}
              >
                Choose
              </BUIBadgeButton>
            </XStack>
          </BUISection>
        </>
      )}
      {category === 'Overlays' && (
        <BUISection
          name="Badge placement & cutouts"
          measurement="Content44/badge20. Circle anchors on the diagonal; Square centers at a corner; Corner sits outside horizontally. Offsets use physical-pixel truncation. Cutout radius=max(badge dimensions)/2 +2."
        >
          <YStack px={16} gap={12}>
            <BUIChoices
              values={['Circle', 'Square', 'Corner'] as const}
              value={strategy}
              onChange={setStrategy}
            />
            <BUIChoices
              values={['EndTop', 'StartTop', 'EndBottom', 'StartBottom'] as const}
              value={direction}
              onChange={setDirection}
            />
            <BUIChoices values={['Cutout', 'Plain'] as const} value={cutout} onChange={setCutout} />
            <BUIChoices
              values={['Mark', 'Count', 'None'] as const}
              value={badge}
              onChange={setBadge}
            />
            <YStack height={120} rounded={20} bg={c.surface} items="center" justify="center">
              <BUIBadgedAvatar
                source={artwork}
                size={44}
                shape={strategy === 'Circle' ? 'circle' : 'rounded'}
                label="Sample avatar placement"
                strategy={strategy}
                direction={direction}
                cutout={cutout === 'Cutout'}
                badge={
                  badge === 'None' ? null : badge === 'Count' ? (
                    <BUICounter count="99+" tone="primary" />
                  ) : (
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
                  )
                }
              />
            </YStack>
          </YStack>
        </BUISection>
      )}
    </BUIPage>
  );
}
