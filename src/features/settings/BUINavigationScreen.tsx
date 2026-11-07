import React, { useState } from 'react';
import { ScrollView } from 'react-native';
import { Bell, Compass, History, MoreHorizontal, Settings, Wallet } from '@tamagui/lucide-icons';
import { XStack, YStack } from 'tamagui';
import {
  BUIPage,
  BUISection,
  BUIChoices,
  BUIText,
  BUIButton,
  BUICard,
  BUIListRow,
  BUIHeader,
  BUIHeaderAction,
  BUIHeaderIcon,
  BUILargeHeader,
  BUITabBar,
  BUIBottomBar,
  type BUINavigationTab,
  useBUITheme,
} from '~/shared/ui/BUI';
import { useBUIStore } from '~/state/buiStore';

const categories = ['Headers', 'Scrolling', 'Navigation'] as const;

export function BUINavigationScreen() {
  const c = useBUITheme();
  const appearance = useBUIStore((state) => state.appearance);
  const [category, setCategory] = useState<(typeof categories)[number]>('Headers');
  const [titleMode, setTitleMode] = useState<'Short' | 'Long' | 'Hidden'>('Short');
  const [subtitleMode, setSubtitleMode] = useState<'None' | 'Subtitle' | 'Updating'>('Subtitle');
  const [fit, setFit] = useState<'Ellipsis' | 'Shrink'>('Ellipsis');
  const [actionMode, setActionMode] = useState<'None' | 'One' | 'Two'>('One');
  const [insets, setInsets] = useState(false);
  const [offset, setOffset] = useState(0);
  const [tab, setTab] = useState('wallet');
  const [exploreHidden, setExploreHidden] = useState(false);
  const [depth, setDepth] = useState(0);
  const [closed, setClosed] = useState(false);
  const [notice, setNotice] = useState('All navigation stays within these samples.');
  const inset = insets ? 24 : 0;
  const title =
    titleMode === 'Long' ? 'A very long wallet name to inspect title fitting' : 'Everyday wallet';
  const action = () => setNotice('Sample header action pressed.');
  const actions =
    actionMode === 'None' ? undefined : (
      <>
        {actionMode === 'Two' && (
          <BUIHeaderAction label="Sample notifications" onPress={action}>
            <Bell size={22} color={c.secondaryButton[3]} />
          </BUIHeaderAction>
        )}
        <BUIHeaderAction label="Sample more actions" onPress={action}>
          <MoreHorizontal size={22} color={c.secondaryButton[3]} />
        </BUIHeaderAction>
      </>
    );
  const common = {
    title,
    subtitle: subtitleMode === 'Subtitle' ? 'Wallet subtitle' : undefined,
    updating: subtitleMode === 'Updating',
    textVisible: titleMode !== 'Hidden',
    shrink: fit === 'Shrink',
    actions,
    topInset: inset,
    onNavigate: () => setNotice('Sample back or close pressed.'),
  };
  const tabs: BUINavigationTab[] = [
    { id: 'wallet', title: 'Wallet', Icon: Wallet },
    { id: 'activity', title: 'Activity', Icon: History },
    { id: 'explore', title: 'Explore', Icon: Compass },
    { id: 'settings', title: 'Settings', Icon: Settings },
  ].map(({ id, title: label, Icon }) => ({
    id,
    title: label,
    renderIcon: (color, size) => <Icon color={color} size={size} />,
    unread: id === 'activity',
    hidden: id === 'explore' && exploreHidden,
    onLongPress: () => setNotice(`Long-pressed sample ${label} tab.`),
  }));
  return (
    <BUIPage
      title="BUI / Headers & navigation"
      status={notice}
      controls={
        <YStack gap={12}>
          <BUIChoices values={categories} value={category} onChange={setCategory} />
          <BUIChoices
            values={['No insets', '24-point insets'] as const}
            value={insets ? '24-point insets' : 'No insets'}
            onChange={(value) => setInsets(value !== 'No insets')}
          />
        </YStack>
      }
    >
      {category === 'Headers' && (
        <>
          <YStack px={16} gap={12}>
            <BUIChoices
              values={['Short', 'Long', 'Hidden'] as const}
              value={titleMode}
              onChange={setTitleMode}
            />
            <BUIChoices
              values={['None', 'Subtitle', 'Updating'] as const}
              value={subtitleMode}
              onChange={setSubtitleMode}
            />
            <BUIChoices values={['Ellipsis', 'Shrink'] as const} value={fit} onChange={setFit} />
            <BUIChoices
              values={['None', 'One', 'Two'] as const}
              value={actionMode}
              onChange={setActionMode}
            />
          </YStack>
          <BUISection
            name="Centered title"
            measurement="Content height64 / centered heading24/32. Actions and navigation are caller-provided. Embedded specimens omit system insets unless the sample inset control is enabled."
          >
            <BUIHeader {...common} variant="centered" />
          </BUISection>
          <BUISection
            name="Simple header"
            measurement="Height64 / horizontal16 / heading20 / subtitle14/20 Medium / action circle32 / minimum touch48. Header glyphs use BUI's22-point convention."
          >
            <BUIHeader {...common} variant="simple" updating={false} />
          </BUISection>
          <BUISection
            name="Modal header & title action"
            measurement="Height64 / horizontal16 / heading20 / subtitle container20 / subtitle14 Regular / updating spinner12, stroke1.5 / full-width divider0.5. Back/close stay left."
          >
            <BUIHeader
              {...common}
              variant="modal"
              navigation="close"
              divider
              titleLabel="Choose sample wallet"
              onTitlePress={() => setNotice('Sample wallet title selected.')}
            />
          </BUISection>
          <BUISection
            name="Header icon & unread dot"
            measurement="Touch48 / BUI glyph22 / optional semantic red dot6, using the corner badge placement. Neutral circular action buttons use the softer light secondary fill."
          >
            <XStack px={16} gap={16}>
              <BUIHeaderIcon label="Notifications" onPress={action}>
                <Bell size={22} color={c.iconSecondary} />
              </BUIHeaderIcon>
              <BUIHeaderIcon label="Notifications" badge onPress={action}>
                <Bell size={22} color={c.iconSecondary} />
              </BUIHeaderIcon>
              <BUIHeaderAction label="Disabled header action" disabled onPress={action}>
                <MoreHorizontal size={22} color={c.secondaryButton[3]} />
              </BUIHeaderAction>
            </XStack>
          </BUISection>
          <BUISection
            name="Fitting & transitions"
            measurement="Measured title fitting uses .95 steps down to .85, then ellipsis. Text/action opacity and subtitle height/fade use180 ms cubic(.4,0,.2,1). Reduced motion snaps."
          >
            <YStack px={16}>
              <BUIText kind="body2" color={c.muted}>
                Hidden title actions leave the touch and accessibility trees immediately. Wider
                action groups reserve matching space on both sides to keep the title centered.
              </BUIText>
            </YStack>
          </BUISection>
        </>
      )}
      {category === 'Scrolling' && (
        <>
          <BUISection
            name="Collapsing large title"
            measurement="Expanded84 → collapsed0 / horizontal16 / heading32 / bottom-aligned and clipped. The large title disappears; it does not turn into a smaller centered title."
          >
            <YStack mx={16} height={400} rounded={16} overflow="hidden" bg={c.surface}>
              <BUILargeHeader title="Wallet activity" offset={offset} topInset={inset} />
              <ScrollView
                nestedScrollEnabled
                style={{ flex: 1 }}
                scrollEventThrottle={16}
                onScroll={({ nativeEvent }) => setOffset(Math.max(0, nativeEvent.contentOffset.y))}
              >
                {Array.from({ length: 14 }, (_, index) => (
                  <BUIListRow
                    key={index}
                    title={`Sample item ${index + 1}`}
                    subtitle="Scroll inside this frame to collapse the title"
                  />
                ))}
              </ScrollView>
            </YStack>
            <YStack px={16}>
              <BUIText kind="body2" color={c.muted}>
                This maps scroll position to the source height limits. Native nested-scroll physics,
                snapping and status-bar behavior differ.
              </BUIText>
            </YStack>
          </BUISection>
        </>
      )}
      {category === 'Navigation' && (
        <>
          <BUISection
            name="Bottom tabs"
            measurement="Content64 + bottom inset once / horizontal16 / equal-width visible tabs / icon28 / label12 Medium / gap4. Active BUI blue, inactive tab tone. Tap and long press are separate callbacks."
          >
            <BUICard padding={16}>
              <YStack gap={4}>
                <BUIText kind="h3">{tabs.find((item) => item.id === tab)?.title}</BUIText>
                <BUIText kind="body2" color={c.muted}>
                  Local tab content only.
                </BUIText>
              </YStack>
            </BUICard>
            <BUITabBar
              items={tabs}
              selectedId={tab}
              bottomInset={inset}
              divider
              onSelect={(item) => {
                setTab(item.id);
                setNotice(`Sample ${item.title} tab selected.`);
              }}
            />
            <YStack px={16}>
              <BUIChoices
                values={['All tabs', 'Hide Explore'] as const}
                value={exploreHidden ? 'Hide Explore' : 'All tabs'}
                onChange={(value) => {
                  setExploreHidden(value === 'Hide Explore');
                  if (value === 'Hide Explore' && tab === 'explore') setTab('wallet');
                }}
              />
            </YStack>
          </BUISection>
          <BUISection
            name="Local back & close flow"
            measurement="A standalone root uses X on the left. Intermediate steps use ArrowLeft. Closing only dismisses this embedded sample; Settings and Expo navigation remain unchanged."
          >
            <BUICard>
              {closed ? (
                <YStack p={16}>
                  <BUIText>Sample flow closed.</BUIText>
                  <BUIButton
                    appearance={appearance}
                    onPress={() => {
                      setClosed(false);
                      setDepth(0);
                    }}
                  >
                    Reopen sample
                  </BUIButton>
                </YStack>
              ) : (
                <>
                  <BUIHeader
                    title={depth ? `Sample step ${depth}` : 'Sample root'}
                    navigation={depth ? 'back' : 'close'}
                    onNavigate={() => {
                      if (depth) setDepth(depth - 1);
                      else setClosed(true);
                    }}
                  />
                  <YStack p={16} gap={12}>
                    <BUIText kind="body2" color={c.muted}>
                      {depth ? 'Back returns one sample step.' : 'Close dismisses this sample.'}
                    </BUIText>
                    <BUIButton
                      appearance={appearance}
                      state={depth >= 3 ? 'Disabled' : 'Default'}
                      onPress={() => setDepth((current) => Math.min(3, current + 1))}
                    >
                      Next sample step
                    </BUIButton>
                  </YStack>
                </>
              )}
            </BUICard>
          </BUISection>
          <BUISection
            name="Bottom action bar"
            measurement="Content84 + bottom inset once / horizontal16 / gap12 / transparent-to-page fade reaching opaque at70%. Buttons use their own56-point geometry."
          >
            <BUIBottomBar bottomInset={inset}>
              <YStack flex={1}>
                <BUIButton
                  appearance={appearance}
                  variant="Secondary"
                  size="large"
                  fullWidth
                  onPress={action}
                >
                  Receive
                </BUIButton>
              </YStack>
              <YStack flex={1}>
                <BUIButton appearance={appearance} size="large" fullWidth onPress={action}>
                  Send
                </BUIButton>
              </YStack>
            </BUIBottomBar>
          </BUISection>
        </>
      )}
    </BUIPage>
  );
}
