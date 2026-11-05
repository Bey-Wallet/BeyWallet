import React, { useState } from 'react';
import {
  ArrowRightLeft,
  Bell,
  CircleCheck,
  Info,
  Shield,
  Trash2,
  Wallet,
} from '@tamagui/lucide-icons';
import { XStack, YStack } from 'tamagui';
import {
  BUIPage,
  BUISection,
  BUIChoices,
  BUIText,
  BUIAvatar,
  BUIBadgedAvatar,
  BUICircleIcon,
  BUILabel,
  BUIIcon,
  BUISelectionRow,
  BUIListRow,
  BUIListGroup,
  BUIListCheckRow,
  BUIListHeader,
  BUIPropertyRow,
  BUICopyRow,
  BUIDescriptionRow,
  BUIContentRow,
  BUIListLoadingRow,
  BUIListErrorRow,
  BUIListRetryRow,
  BUIListSkeletonRow,
  useBUITheme,
} from '~/shared/ui/BUI';

const categories = ['Rows', 'Selection', 'Properties', 'Wallet rows', 'States', 'Groups'] as const;

export function BUIListsScreen() {
  const c = useBUITheme();
  const [category, setCategory] = useState<(typeof categories)[number]>('Rows');
  const [selected, setSelected] = useState('Everyday wallet');
  const [checked, setChecked] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [removed, setRemoved] = useState(false);
  const [notice, setNotice] = useState('Only synthetic data. Actions update this preview.');
  const action = () => setNotice('Sample row pressed.');
  const icon = <BUICircleIcon name="walletSmall" size={36} iconSize={20} tone="secondary" />;
  const avatar = (size = 44, initials = 'B') => (
    <BUIAvatar size={size} initials={initials} label="" />
  );
  return (
    <BUIPage
      title="BUI / Lists & rows"
      status={notice}
      controls={<BUIChoices values={categories} value={category} onChange={setCategory} />}
    >
      {category === 'Rows' && (
        <>
          <BUISection
            name="Text rows"
            measurement="Minimum56 / padding16 × 8 / title16 Medium / subtitle14 Regular with native line metrics / text gaps2 / leading gap16 / trailing gap8. Blank subtitles are omitted."
          >
            <BUIListGroup>
              <BUIListRow title="Title only" />
              <BUIListRow title="Title and subtitle" subtitle="Supporting information" />
              <BUIListRow
                title="Navigation"
                leading={icon}
                destination="internal"
                onPress={action}
              />
              <BUIListRow
                title="External destination"
                subtitle="Sample website"
                leading={icon}
                destination="external"
                onPress={() =>
                  setNotice('External destination preview pressed. No website opened.')
                }
              />
              <BUIListRow
                title="Current value"
                subtitle="Value stays at the trailing edge"
                value="USD"
                destination="internal"
                onPress={action}
              />
              <BUIListRow
                title="Title with a badge"
                tags={<BUILabel>New</BUILabel>}
                subtitle="Title-to-badge gap8"
                onPress={action}
              />
              <BUIListRow
                title="Three content slots"
                subtitle="Supporting information"
                description="An optional description grows the row naturally."
                leading={icon}
              />
              <BUIListRow
                title="No text gap"
                subtitle="Title and subtitle touch their natural line boxes"
                textGap={false}
                onPress={action}
                onLongPress={() => setNotice('Sample row long-pressed.')}
              />
            </BUIListGroup>
          </BUISection>
          <BUISection
            name="Status, destructive & disabled"
            measurement="Read-only status has no press handler or navigation cue. Destructive actions use semantic red. Disabled rows block taps and long presses."
          >
            <BUIListGroup>
              <BUIListRow
                title="Connection status"
                subtitle="All sample connections available"
                subtitleTone="success"
                leading={<CircleCheck size={22} color={c.positive} />}
                value="Connected"
              />
              <BUIListRow
                title="Unavailable action"
                subtitle="Disabled preview"
                disabled
                leading={icon}
                destination="internal"
                onPress={action}
              />
              {removed ? (
                <BUIListRow
                  title="Restore sample row"
                  onPress={() => {
                    setRemoved(false);
                    setNotice('Sample row restored.');
                  }}
                />
              ) : (
                <BUIListRow
                  title="Remove sample"
                  subtitle="Only removes this preview row"
                  tone="destructive"
                  leading={<Trash2 size={22} color={c.negative} />}
                  onPress={() => {
                    setRemoved(true);
                    setNotice('Sample row removed.');
                  }}
                />
              )}
            </BUIListGroup>
          </BUISection>
          <BUISection
            name="Long content & top alignment"
            measurement="Titles/subtitles default to one line. Explicit line limits and description slots allow longer content. Minimum heights grow with text."
          >
            <BUIListGroup>
              <BUIListRow
                title="A longer sample title that wraps across multiple lines in a narrow layout"
                subtitle="Supporting text can also wrap when the row explicitly allows more lines."
                maxTitleLines={2}
                maxSubtitleLines={3}
                align="top"
                leading={icon}
                destination="internal"
                onPress={action}
              />
              <BUIListRow title="No blank subtitle gap" subtitle="   " />
            </BUIListGroup>
          </BUISection>
        </>
      )}
      {category === 'Selection' && (
        <>
          <BUISection
            name="Whole-row check selection"
            measurement="Minimum56 / base row spacing / selected check28 / BUI blue. This sample is a radio group; tapping the selected row keeps it selected."
          >
            <BUIListGroup>
              {['Everyday wallet', 'Travel wallet'].map((title) => (
                <BUIListCheckRow
                  key={title}
                  title={title}
                  subtitle={title === 'Everyday wallet' ? 'Everyday use' : undefined}
                  leading={icon}
                  role="radio"
                  checked={selected === title}
                  onCheckedChange={() => setSelected(title)}
                />
              ))}
            </BUIListGroup>
          </BUISection>
          <BUISection
            name="Checkbox, switch & read-only selection"
            measurement="Reuses BUI selection controls: checkbox22 / switch50 × 30 / row padding16 × 12 or16 × 8. Independent child controls do not duplicate the row action."
          >
            <BUIListGroup>
              <BUISelectionRow
                kind="checkbox"
                checked={checked}
                label="I understand"
                onCheckedChange={setChecked}
                onInfo={() => setNotice('Information action pressed independently.')}
              />
              <BUISelectionRow
                kind="switch"
                checked={enabled}
                label="Sample notifications"
                description="Preview preference only"
                onCheckedChange={setEnabled}
              />
              <BUISelectionRow
                kind="checkbox"
                checked
                label="Disabled selection"
                disabled
                onCheckedChange={action}
              />
              <BUIListCheckRow title="Read-only selection" checked />
            </BUIListGroup>
          </BUISection>
        </>
      )}
      {category === 'Properties' && (
        <>
          <BUISection
            name="Property rows"
            measurement="Default padding19 × 12 / key14 Regular / value14 Medium / key-value gap8 / prefix-postfix gaps4 / top alignment. Single-line values use middle ellipsis."
          >
            <BUIListGroup>
              <BUIPropertyRow title="Network" value="Bitcoin" />
              <BUIPropertyRow
                title="Fee"
                value="2 sats"
                prefix={<Info size={14} color={c.iconSecondary} />}
              />
              <BUIPropertyRow
                title="Mint"
                value="Everyday mint"
                postfix={<BUIIcon name="chevron" tone="tertiary" />}
                onPress={action}
              />
              <BUIPropertyRow
                title="Long value"
                value="A much longer descriptive value that wraps across two lines."
                maxValueLines={2}
              />
            </BUIListGroup>
          </BUISection>
          <BUISection
            name="Large properties"
            measurement="Padding16 / key16 Regular / value16 Medium / description14 Regular / value-description gap2 / affix gap4."
          >
            <BUIListGroup>
              <BUIPropertyRow title="Total" value="12,500 sats" description="$8.12" large />
              <BUIPropertyRow
                title="Destination"
                value="Everyday mint"
                description="Sample mint"
                large
                postfix={<BUIIcon name="chevron" tone="tertiary" />}
                onPress={action}
              />
            </BUIListGroup>
          </BUISection>
          <BUISection
            name="Copy rows"
            measurement="Minimum100 / secondary title14 / primary value16 Medium, maximum2 lines / copy glyph24 inside a48-point touch area. Only the copy action is interactive."
          >
            <BUIListGroup>
              <BUICopyRow
                title="Public sample address"
                value="bey-demo-public-address-1234567890"
                leading={icon}
                onCopy={() => setNotice('Copy feedback preview. Clipboard unchanged.')}
              />
            </BUIListGroup>
          </BUISection>
          <BUISection
            name="Description & centered content"
            measurement="Description padding16 / body14/20. Centered content: horizontal16 / heading20 / body16/24 / description gap4."
          >
            <BUIDescriptionRow>
              A short explanation outside a group of related preferences.
            </BUIDescriptionRow>
            <BUIContentRow
              title="Your wallet, ready"
              description="A centered title and description block."
            />
          </BUISection>
        </>
      )}
      {category === 'Wallet rows' && (
        <>
          <BUISection
            name="Account rows"
            measurement="Minimum76 / avatar44 / optional badge20 / leading gap16 / text gap2 / name-tag gap6 / price-change gap6. Amount strings are supplied by the caller."
          >
            <BUIListGroup>
              <BUIListRow
                minHeight={76}
                leading={
                  <BUIBadgedAvatar
                    initials="B"
                    label=""
                    size={44}
                    badge={<BUIAvatar initials="L" label="" size={20} />}
                  />
                }
                title={
                  <XStack flex={1} justify="space-between" gap={16} items="center">
                    <XStack flexShrink={1} items="center" gap={6}>
                      <BUIText>Bitcoin</BUIText>
                      <BUIIcon name="verification" tone="accent" />
                    </XStack>
                    <BUIText>12,500 sats</BUIText>
                  </XStack>
                }
                subtitle={
                  <XStack justify="space-between" gap={8}>
                    <XStack gap={6}>
                      <BUIText kind="body2" color={c.muted}>
                        $64,960
                      </BUIText>
                      <BUIText kind="body2" color={c.positive}>
                        +4.37%
                      </BUIText>
                    </XStack>
                    <BUIText kind="body2" color={c.muted}>
                      $8.12
                    </BUIText>
                  </XStack>
                }
                accessibilityLabel="Bitcoin, 12,500 sats, 8 dollars 12 cents"
                onPress={action}
              />
              <BUIListRow
                minHeight={76}
                title="Unverified sample asset"
                subtitle="Unverified asset"
                subtitleTone="warning"
                leading={avatar(44, '?')}
                onPress={action}
              />
              <BUIListRow
                minHeight={76}
                title="Blocked sample asset"
                subtitle="Scam"
                subtitleTone="error"
                leading={avatar(44, '!')}
                onPress={action}
              />
            </BUIListGroup>
          </BUISection>
          <BUISection
            name="Compact asset & mint rows"
            measurement="Minimum52 / avatar28 / optional badge14 / title-slot gap4 / title16 Medium, extended name16 Regular / optional selected check28."
          >
            <BUIListGroup>
              <BUIListRow
                minHeight={52}
                leading={
                  <BUIBadgedAvatar
                    initials="U"
                    label=""
                    size={28}
                    badge={<BUIAvatar initials="B" size={14} label="" />}
                  />
                }
                title={
                  <XStack gap={4} items="center">
                    <BUIText>USD</BUIText>
                    <BUILabel>Cash</BUILabel>
                  </XStack>
                }
                trailing={<BUIIcon name="check" size={28} tone="accent" />}
                onPress={action}
                accessibilityLabel="USD, Cash, selected"
              />
              <BUIListRow
                minHeight={52}
                leading={avatar(28, 'M')}
                title="Everyday mint"
                value="Connected"
                destination="internal"
                onPress={action}
              />
              <BUIListRow
                minHeight={52}
                leading={<ArrowRightLeft size={22} color={c.iconSecondary} />}
                title="Transfer"
                subtitle="Between sample mints"
                onPress={action}
              />
            </BUIListGroup>
          </BUISection>
        </>
      )}
      {category === 'States' && (
        <>
          <BUISection
            name="Loading & skeleton rows"
            measurement="Loader72 / spinner24, keeping the existing spinner. Account skeleton minimum76 / circle44 / text placeholders19 and20 / text gap2. Skeleton is static."
          >
            <BUIListGroup>
              <BUIListLoadingRow />
              <BUIListSkeletonRow />
            </BUIListGroup>
          </BUISection>
          <BUISection
            name="Error & retry rows"
            measurement="Error minimum72 / horizontal16 / red label14 Medium, maximum2 lines. Retry minimum72 / message14/20 / gap12 / small primary button36 with48 touch area."
          >
            <BUIListGroup>
              <BUIListErrorRow>Could not load the sample list.</BUIListErrorRow>
              <BUIListRetryRow
                message="Unable to load"
                onRetry={() => setNotice('Sample retry pressed. No network request.')}
              />
            </BUIListGroup>
          </BUISection>
        </>
      )}
      {category === 'Groups' && (
        <>
          <BUISection
            name="Grouped rows"
            measurement="Outer margins16 / card fill / corners16. Dividers0.5 / start inset16 overlay the preceding row without adding height. Child rows stay square inside the clipped group."
          >
            <BUIListHeader
              title="Preferences"
              description="Header padding16 × 12; title16 / description14"
              trailing={<BUILabel>3</BUILabel>}
            />
            <BUIListGroup>
              <BUIListRow
                title="Wallet"
                leading={<Wallet size={22} color={c.iconSecondary} />}
                destination="internal"
                onPress={action}
              />
              <BUIListRow
                title="Privacy"
                leading={<Shield size={22} color={c.iconSecondary} />}
                destination="internal"
                onPress={action}
              />
              <BUIListRow
                title="Notifications"
                leading={<Bell size={22} color={c.iconSecondary} />}
                destination="internal"
                onPress={action}
              />
            </BUIListGroup>
          </BUISection>
          <BUISection
            name="Single group & clickable header"
            measurement="A single row clips all corners and has no divider. Clickable header uses a2-point title-chevron gap and an expanded touch area."
          >
            <BUIListHeader
              title="Wallets"
              description="Choose a sample wallet"
              onPress={action}
              trailing={<BUILabel>2</BUILabel>}
            />
            <BUIListGroup>
              <BUIListRow
                title="Standalone row"
                leading={icon}
                destination="internal"
                onPress={action}
              />
            </BUIListGroup>
          </BUISection>
          <BUISection
            name="Extra divider inset"
            measurement="Extra inset adds to the default16. This sample uses16 + 36 + 16 = 68, matching a36-point leading slot plus gap16."
          >
            <BUIListGroup separatorExtraInset={52}>
              <BUIListRow title="First row" leading={icon} onPress={action} />
              <BUIListRow title="Second row" leading={icon} onPress={action} />
            </BUIListGroup>
          </BUISection>
          <BUIDescriptionRow>
            These are BUI preview dimensions. Inter, Lucide and native text layout differ from the
            source; native ripple, island press-scale and animated shimmer are not reproduced.
          </BUIDescriptionRow>
        </>
      )}
    </BUIPage>
  );
}
