import { useBUITheme } from '~/shared/ui/BUI/useBUITheme';
import React, { useState } from 'react';
import { ChevronRight, Wallet } from '@tamagui/lucide-icons';
import { XStack, YStack } from 'tamagui';
import {
  BUIChoices,
  BUIPage,
  BUISection,
  BUIText,
  buiDimensions,
  buiRadii,
  buiRowLayout,
  buiSeparator,
  buiSpacing,
} from '~/shared/ui/BUI';
import { BUILayoutFrame } from '~/shared/ui/BUI/BUILayoutFrame';

export function BUILayoutScreen() {
  const c = useBUITheme();
  const [category, setCategory] = useState<
    'Spacing' | 'Corners & groups' | 'Alignment' | 'Screen frame'
  >('Spacing');
  const [rows, setRows] = useState<'Single' | 'Grouped'>('Grouped');
  const [copy, setCopy] = useState<'Short' | 'Long'>('Short');
  const [width, setWidth] = useState<'320' | '360' | '412'>('360');
  const [system, setSystem] = useState<'No insets' | 'System example'>('System example');
  const [footer, setFooter] = useState<'Action bar' | 'No bar'>('Action bar');
  const [presses, setPresses] = useState(0);
  return (
    <BUIPage
      title="BUI / Layout & spacing"
      status={`Preview actions: ${presses}. Measurements use logical points. Frame widths and system inset examples are simulated.`}
      controls={
        <BUIChoices
          values={['Spacing', 'Corners & groups', 'Alignment', 'Screen frame'] as const}
          value={category}
          onChange={setCategory}
        />
      }
    >
      {category === 'Spacing' && (
        <>
          <BUISection
            name="Spacing scale"
            measurement="Named offsets use 4, 16 and 32. The scale also includes the 2-point detail gap and common 8/12/24-point composition gaps."
          >
            <YStack px={16} gap={16}>
              {Object.entries(buiSpacing).map(([name, value]) => (
                <XStack key={name} gap={16} items="center">
                  <YStack width={40}>
                    <YStack width={value} height={16} bg={c.primary} />
                  </YStack>
                  <BUIText kind="body2" flex={1}>
                    {name} · {value}
                  </BUIText>
                </XStack>
              ))}
            </YStack>
          </BUISection>
          <BUISection
            name="Outer margin / inner padding"
            measurement="Standard bundle: outer16 / inner16. Phrase composition: outer32 / inner20 horizontal,16 vertical."
          >
            {[
              { margin: 16, padding: 16 },
              { margin: 32, padding: 20 },
            ].map((item) => (
              <YStack key={item.margin} px={item.margin} bg={c.raised}>
                <YStack px={item.padding} py={16} rounded={20} bg={c.surface}>
                  <YStack minHeight={56} bg={c.canvas} justify="center" items="center">
                    <BUIText kind="body2">
                      {item.margin} outside · {item.padding} inside
                    </BUIText>
                  </YStack>
                </YStack>
              </YStack>
            ))}
          </BUISection>
          <BUISection
            name="Control and bar heights"
            measurement="Action visual32; row minimum56; header64; bottom action area84 before navigation inset. Interactive targets remain at least48."
          >
            <XStack px={16} gap={12} flexWrap="wrap" items="flex-end">
              {Object.entries(buiDimensions).map(([name, value]) => (
                <YStack key={name} width={84} gap={8}>
                  <YStack height={value} rounded={8} bg={c.raised} items="center" justify="center">
                    <BUIText>{value}</BUIText>
                  </YStack>
                  <BUIText kind="body3" color={c.muted}>
                    {name}
                  </BUIText>
                </YStack>
              ))}
            </XStack>
          </BUISection>
        </>
      )}
      {category === 'Corners & groups' && (
        <>
          <BUISection
            name="Corner scale"
            measurement="0/4/8/12/16/20. Standalone bundles use20; item grouping uses16. Pill shapes remain circular. Tiles80 × 64 are illustrative."
          >
            <XStack px={16} gap={16} flexWrap="wrap">
              {[0, 4, 8, 12, 16, 20].map((radius) => (
                <YStack
                  key={radius}
                  width={80}
                  height={64}
                  rounded={radius}
                  bg={c.raised}
                  items="center"
                  justify="center"
                >
                  <BUIText>R{radius}</BUIText>
                </YStack>
              ))}
            </XStack>
          </BUISection>
          <BUISection
            name="Single / first / middle / last"
            measurement="The group clips its children. First rows round the top; middle rows stay square; last rows round the bottom. Separator0.5/start16."
          >
            <YStack px={16}>
              <BUIChoices values={['Single', 'Grouped'] as const} value={rows} onChange={setRows} />
            </YStack>
            {[buiRadii.card, buiRadii.item].map((radius) => (
              <YStack key={radius} mx={16} rounded={radius} overflow="hidden" bg={c.surface}>
                {Array.from({ length: rows === 'Single' ? 1 : 3 }, (_, index) => (
                  <YStack key={index}>
                    <YStack minHeight={56} px={16} py={8} justify="center">
                      <BUIText>
                        {rows === 'Single'
                          ? 'Single item'
                          : index === 0
                            ? 'First item'
                            : index === 1
                              ? 'Middle item'
                              : 'Last item'}{' '}
                        · R{radius}
                      </BUIText>
                    </YStack>
                    {rows === 'Grouped' && index < 2 && (
                      <YStack
                        position="absolute"
                        b={0}
                        l={buiSeparator.startInset}
                        r={0}
                        height={buiSeparator.thickness}
                        bg={c.separator}
                      />
                    )}
                  </YStack>
                ))}
              </YStack>
            ))}
          </BUISection>
        </>
      )}
      {category === 'Alignment' && (
        <BUISection
          name="Row alignment & wrapping"
          measurement="Minimum56; padding16 × 8; leading gap16; text gap2; trailing gap8. Icon surface36 and chevron16 are sample choices. Text can grow the row."
        >
          <YStack px={16}>
            <BUIChoices values={['Short', 'Long'] as const} value={copy} onChange={setCopy} />
          </YStack>
          <XStack
            mx={16}
            minHeight={buiDimensions.item}
            px={buiRowLayout.paddingX}
            py={buiRowLayout.paddingY}
            rounded={20}
            bg={c.surface}
            items="center"
          >
            <YStack
              width={36}
              height={36}
              rounded={18}
              bg={c.raised}
              mr={buiRowLayout.iconGap}
              items="center"
              justify="center"
            >
              <Wallet size={20} color={c.icon} />
            </YStack>
            <YStack flex={1} minWidth={0} gap={buiRowLayout.textGap}>
              <BUIText numberOfLines={1} ellipsizeMode="tail">
                {copy === 'Long'
                  ? 'A very long wallet title that yields space to its trailing control'
                  : 'My wallet'}
              </BUIText>
              <BUIText kind="body2" color={c.muted}>
                {copy === 'Long'
                  ? 'Descriptions wrap naturally and increase the row height instead of being clipped inside a fixed-height container.'
                  : 'Supporting description'}
              </BUIText>
            </YStack>
            <ChevronRight
              size={16}
              color={c.muted}
              style={{ marginLeft: buiRowLayout.trailingGap }}
            />
          </XStack>
        </BUISection>
      )}
      {category === 'Screen frame' && (
        <BUISection
          name="Insets & docked bottom actions"
          measurement="Header64; bottom area84 + navigation inset; action padding16/gap12. Content reserves the measured bars instead of double-counting system insets. Fade reaches page color at70%. Frame520 and insets24 are preview choices."
        >
          <YStack px={16} gap={12}>
            <BUIChoices values={['320', '360', '412'] as const} value={width} onChange={setWidth} />
            <BUIChoices
              values={['No insets', 'System example'] as const}
              value={system}
              onChange={setSystem}
            />
            <BUIChoices
              values={['Action bar', 'No bar'] as const}
              value={footer}
              onChange={setFooter}
            />
          </YStack>
          <BUILayoutFrame
            width={Number(width)}
            systemInsets={system === 'System example'}
            footer={footer === 'Action bar'}
            onPress={() => setPresses((count) => count + 1)}
          />
        </BUISection>
      )}
    </BUIPage>
  );
}
