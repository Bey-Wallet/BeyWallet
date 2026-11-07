import React, { useState } from 'react';
import { Copy, ExternalLink, Trash2 } from '@tamagui/lucide-icons';
import { XStack, YStack } from 'tamagui';
import {
  BUIPage,
  BUISection,
  BUIChoices,
  BUIText,
  BUIButton,
  BUIHeader,
  BUIPropertyRow,
  BUIActionMenu,
  BUITooltip,
  useBUITheme,
} from '~/shared/ui/BUI';
import { useBUIStore } from '~/state/buiStore';

const orders = [
  { id: 'recent', title: 'Most recent' },
  { id: 'oldest', title: 'Oldest first' },
  { id: 'amount', title: 'Sample amount' },
];
const longMenu = Array.from({ length: 20 }, (_, index) => ({
  id: `option-${index + 1}`,
  title: `Sample option ${index + 1}${index === 8 ? ' with a much longer description to inspect truncation' : ''}`,
}));

export function BUIMenusScreen() {
  const c = useBUITheme();
  const appearance = useBUIStore((state) => state.appearance);
  const [category, setCategory] = useState<'Menus' | 'Tooltips'>('Menus');
  const [alignment, setAlignment] = useState<'Start' | 'Center'>('Start');
  const [selected, setSelected] = useState('recent');
  const [above, setAbove] = useState<'Below' | 'Above'>('Below');
  const [tail, setTail] = useState<'Start tail' | 'Centered tail'>('Start tail');
  const [position, setPosition] = useState<'Left' | 'Center' | 'Right'>('Left');
  const [notice, setNotice] = useState('Menus and tooltips only update this preview.');
  const action = (id: string) => setNotice(`Sample action: ${id}. No external action ran.`);
  const placement = { preferAbove: above === 'Above', centerTail: tail === 'Centered tail' };
  return (
    <BUIPage
      title="BUI / Menus & tooltips"
      status={notice}
      controls={
        <BUIChoices
          values={['Menus', 'Tooltips'] as const}
          value={category}
          onChange={setCategory}
        />
      }
    >
      {category === 'Menus' && (
        <>
          <YStack px={16}>
            <BUIChoices
              values={['Start', 'Center'] as const}
              value={alignment}
              onChange={setAlignment}
            />
          </YStack>
          <BUISection
            name="Action menu"
            measurement="Width cap240 / corners20 / raised fill / offset12 / start or center alignment. Rows48 / horizontal16 / label16 Medium / trailing icon16 in blue / gap8 / dividers0.5 inset16."
          >
            <YStack px={16} items="flex-start">
              <BUIActionMenu
                label="Open sample actions"
                alignment={alignment === 'Start' ? 'start' : 'center'}
                items={[
                  { id: 'copy', title: 'Copy sample', icon: <Copy size={16} color={c.primary} /> },
                  {
                    id: 'open',
                    title: 'Open sample link',
                    icon: <ExternalLink size={16} color={c.primary} />,
                  },
                  { id: 'more', title: 'Another sample action' },
                ]}
                onAction={action}
              />
            </YStack>
          </BUISection>
          <BUISection
            name="Selected options"
            measurement="Selected option uses a blue check16 and radio semantics. Tap or long-press the trigger. Outside tap and Android Back dismiss."
          >
            <YStack px={16} gap={8} items="flex-start">
              <BUIActionMenu
                label="Choose sample order"
                alignment={alignment === 'Start' ? 'start' : 'center'}
                selectedId={selected}
                items={orders}
                onAction={(id) => {
                  setSelected(id);
                  action(id);
                }}
              />
              <BUIText kind="body2" color={c.muted}>
                Selected: {selected}
              </BUIText>
            </YStack>
          </BUISection>
          <BUISection
            name="Disabled & destructive actions"
            measurement="Default labels are primary text. Disabled opacity48% and explicit destructive red are BUI customizations; disabled rows do not select or close the menu."
          >
            <YStack px={16} items="flex-start">
              <BUIActionMenu
                label="Custom action states"
                items={[
                  { id: 'available', title: 'Available action' },
                  { id: 'disabled', title: 'Disabled sample', disabled: true },
                  {
                    id: 'remove',
                    title: 'Remove sample',
                    destructive: true,
                    icon: <Trash2 size={16} color={c.negative} />,
                  },
                ]}
                onAction={action}
              />
            </YStack>
          </BUISection>
          <BUISection
            name="Header overflow & long menu"
            measurement="Overflow uses a48-point target and BUI header glyph22. Long menus scroll within the viewport; long labels ellipsize."
          >
            <BUIHeader
              title="Sample wallet"
              navigation="none"
              actions={
                <BUIActionMenu
                  label="Wallet overflow"
                  iconTrigger
                  items={orders}
                  onAction={action}
                />
              }
            />
            <YStack px={16} items="flex-end">
              <BUIActionMenu label="Open long menu" items={longMenu} onAction={action} />
            </YStack>
          </BUISection>
          <BUISection
            name="Custom content"
            measurement="Arbitrary menu content shares the same surface, positioning and dismissal. This sample composes a property and a button."
          >
            <YStack px={16} items="flex-start">
              <BUIActionMenu
                label="Show custom content"
                renderContent={(dismiss) => (
                  <YStack>
                    <BUIPropertyRow title="Scope" value="Preview only" />
                    <YStack px={16} pb={16}>
                      <BUIButton
                        appearance={appearance}
                        variant="Secondary"
                        fullWidth
                        onPress={() => {
                          if (dismiss()) action('custom');
                        }}
                      >
                        Done
                      </BUIButton>
                    </YStack>
                  </YStack>
                )}
              />
            </YStack>
          </BUISection>
          <BUISection
            name="Menu motion"
            measurement="Enter scale .8→1 over120 ms, alpha30 ms. Exit alpha75 ms with scale reset after74 ms. Pivot follows anchor/menu overlap. Reduced motion snaps."
          >
            <YStack px={16}>
              <BUIText kind="body2" color={c.muted}>
                Position flips above when needed. Pending measurements are canceled on close, blur,
                backgrounding and window/theme changes.
              </BUIText>
            </YStack>
          </BUISection>
        </>
      )}
      {category === 'Tooltips' && (
        <>
          <YStack px={16} gap={12}>
            <BUIChoices values={['Below', 'Above'] as const} value={above} onChange={setAbove} />
            <BUIChoices
              values={['Start tail', 'Centered tail'] as const}
              value={tail}
              onChange={setTail}
            />
            <BUIChoices
              values={['Left', 'Center', 'Right'] as const}
              value={position}
              onChange={setPosition}
            />
          </YStack>
          <BUISection
            name="Icon tooltip"
            measurement="Info16 / touch48 / anchor gap4 / default maximum width200 / body corners12 / neutral attention fill / padding12 × 10 / body14/20. Tail14 × 6, default start inset18."
          >
            <XStack
              px={16}
              justify={
                position === 'Left' ? 'flex-start' : position === 'Right' ? 'flex-end' : 'center'
              }
            >
              <BUITooltip
                label="Explain sample fee"
                text="This is a sample fee explanation. No quote or payment information is loaded."
                {...placement}
              />
            </XStack>
          </BUISection>
          <BUISection
            name="Short & badged explanations"
            measurement="Width follows measured text up to the cap. Optional badge20 / corners4 / horizontal5 / uppercase10 / gap6. Source badge uses white fill and attention-colored text."
          >
            <XStack px={16} gap={12} items="center" flexWrap="wrap">
              <BUITooltip label="Short explanation" text="Short tip" {...placement} />
              <BUITooltip
                label="Explain badge"
                badge="New"
                iconTrigger={false}
                text="A badged sample explanation."
                {...placement}
              />
            </XStack>
          </BUISection>
          <BUISection
            name="Arbitrary anchor & clickable content"
            measurement="Custom anchor text; maximum width288 is the positioning helper's cap. Long bubbles scroll inside the viewport. Clicking this explanation records a local action and dismisses."
          >
            <YStack px={16} items="center">
              <BUITooltip
                label="Explain this sample"
                iconTrigger={false}
                maxWidth={288}
                {...placement}
                text="A longer sample explanation wraps within the reference bubble. Try opening near an edge, changing placement, dismissing with outside tap or Android Back, or tapping the explanation itself. None of these actions changes a setting."
                onContentPress={() => action('tooltip')}
              />
            </YStack>
          </BUISection>
          <BUISection
            name="Tooltip motion & native differences"
            measurement="Scale .3↔1 and alpha over150 ms; enter cubic(0,0,.2,1), exit cubic(.4,0,1,1). Pivot follows the tail. Reduced motion snaps."
          >
            <YStack px={16}>
              <BUIText kind="body2" color={c.muted}>
                These use a native modal host; its focus behavior differs from a non-focusable
                tooltip popup. Inter, Lucide, native coordinates and insets still need Android
                review.
              </BUIText>
            </YStack>
          </BUISection>
        </>
      )}
    </BUIPage>
  );
}
