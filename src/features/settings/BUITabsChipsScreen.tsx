import React, { useState } from 'react';
import { Wallet } from '@tamagui/lucide-icons';
import { XStack, YStack } from 'tamagui';
import {
  BUIPage,
  BUISection,
  BUIChoices,
  BUIText,
  BUIContentTabs,
  BUIChipBar,
  BUIChip,
  BUIOutlineChip,
  BUITag,
  BUITags,
  BUIActionSelector,
  useBUITheme,
} from '~/shared/ui/BUI';

const tabs = ['All', 'Gainers', 'Losers'].map((title) => ({ id: title, title }));
const directions = ['Received', 'Sent'].map((title) => ({ id: title, title }));
const filters = [
  'All activity',
  'Received',
  'Sent',
  'Transfer',
  'Pending',
  'Failed',
  'Older activity',
].map((title) => ({ id: title, title, ...(title === 'Transfer' ? { initials: 'B' } : {}) }));
const wallets = ['Everyday wallet', 'Travel wallet', 'Savings wallet'].map((title) => ({
  id: title,
  title,
}));
const currencies = ['Sats', 'USD', 'EUR'].map((title) => ({ id: title, title }));
const mints = [
  'Everyday mint',
  'A much longer mint name for the menu',
  'Travel mint',
  'Savings mint',
  'Backup mint',
  'Test mint',
  'Another mint',
  'Last mint',
].map((title) => ({ id: title, title }));

export function BUITabsChipsScreen() {
  const c = useBUITheme();
  const [category, setCategory] = useState<'Tabs' | 'Chips' | 'Selectors'>('Tabs');
  const [tab, setTab] = useState('All');
  const [direction, setDirection] = useState('Received');
  const [filter, setFilter] = useState('All activity');
  const [networks, setNetworks] = useState(['Bitcoin']);
  const [percent, setPercent] = useState('5%');
  const [wallet, setWallet] = useState('Everyday wallet');
  const [currency, setCurrency] = useState('Sats');
  const [mint, setMint] = useState('Everyday mint');
  const [notice, setNotice] = useState('Selections affect these samples only.');
  return (
    <BUIPage
      title="BUI / Tabs, chips & selectors"
      status={notice}
      controls={
        <BUIChoices
          values={['Tabs', 'Chips', 'Selectors'] as const}
          value={category}
          onChange={setCategory}
        />
      }
    >
      {category === 'Tabs' && (
        <>
          <BUISection
            name="Content tabs"
            measurement="Track H40 / R20 / padding4. Pill H32 / R16 / card fill. Equal widths, label14 Medium / horizontal16. Slide200 ms, cubic(.4,0,.2,1). Touch area48."
          >
            <YStack px={16}>
              <BUIContentTabs items={tabs} selectedId={tab} onSelect={(item) => setTab(item.id)} />
            </YStack>
            <YStack mx={16} p={16} rounded={16} bg={c.surface} gap={4}>
              <BUIText>{tab} assets</BUIText>
              <BUIText kind="body2" color={c.muted}>
                Selected content changes here.
              </BUIText>
            </YStack>
          </BUISection>
          <BUISection name="Two segments" measurement="Same geometry; two equal-width tabs.">
            <YStack px={16}>
              <BUIContentTabs
                items={directions}
                selectedId={direction}
                onSelect={(item) => setDirection(item.id)}
              />
            </YStack>
          </BUISection>
          <BUISection
            name="Single, empty & missing selection"
            measurement="Empty tabs retain H40 without a pill. A missing selected id places the pill on the first tab."
          >
            <YStack px={16} gap={12}>
              <BUIContentTabs
                items={[{ id: 'overview', title: 'Overview' }]}
                selectedId="overview"
                onSelect={() => setNotice('Overview selected.')}
              />
              <BUIContentTabs items={[]} onSelect={() => {}} />
              <BUIContentTabs
                items={tabs}
                selectedId="missing"
                onSelect={(item) => setNotice(`Fallback sample: ${item.title}`)}
              />
            </YStack>
          </BUISection>
        </>
      )}
      {category === 'Chips' && (
        <>
          <BUISection
            name="Filter chip bar"
            measurement="Chip H32 / R16 / label14 Medium. Padding12; with image start6 / end12, image20 / gap6. Bar sides16 / top8 / bottom16 / gap6. Selected neutral attention fill; scrolls only when needed."
          >
            <BUIChipBar
              items={filters}
              selectedId={filter}
              scrollToSelected
              onSelect={(item) => setFilter(item.id)}
            />
            <YStack px={16}>
              <BUIText kind="body2">Filter: {filter}</BUIText>
            </YStack>
            <YStack px={16}>
              <BUIChoices
                values={['All activity', 'Older activity']}
                value={filter}
                onChange={setFilter}
              />
            </YStack>
          </BUISection>
          <BUISection
            name="Multiple selections"
            measurement="The same chip geometry with independent checkbox states. Multiple selection is a playground composition."
          >
            <XStack px={16} py={8} gap={8} flexWrap="wrap">
              {['Bitcoin', 'Lightning', 'USD'].map((name) => (
                <BUIChip
                  key={name}
                  initials={name.slice(0, 1)}
                  selected={networks.includes(name)}
                  onPress={() =>
                    setNetworks((current) =>
                      current.includes(name)
                        ? current.filter((value) => value !== name)
                        : [...current, name],
                    )
                  }
                >
                  {name}
                </BUIChip>
              ))}
            </XStack>
            <YStack px={16}>
              <BUIText kind="body2">{networks.join(', ') || 'None selected'}</BUIText>
            </YStack>
          </BUISection>
          <BUISection
            name="Outline chips"
            measurement="Content height / R16 / border1.5. Padding12 × 6 / label14 Medium. Neutral tertiary fill when selected; page fill otherwise. Touch area48."
          >
            <XStack px={16} py={8} gap={12} flexWrap="wrap">
              {['5%', '10%', '25%', '50%'].map((value) => (
                <BUIOutlineChip
                  key={value}
                  selected={percent === value}
                  onPress={() => setPercent(value)}
                >
                  {value}
                </BUIOutlineChip>
              ))}
            </XStack>
          </BUISection>
          <BUISection
            name="Tags"
            measurement="H32 / R16 / horizontal16 / optional icon16 / gap8 / label14 Medium. Wrapping gaps8. Labels centered within the fixed height."
          >
            <YStack px={16} py={8}>
              <BUITags>
                {['Wallet', 'Network', 'Longer sample tag', 'Read-only tag'].map((value, index) => (
                  <BUITag
                    key={value}
                    icon={
                      index === 0 ? <Wallet size={16} color={c.buttons.Secondary[3]} /> : undefined
                    }
                    onPress={index === 3 ? undefined : () => setNotice(`Tag: ${value}`)}
                  >
                    {value}
                  </BUITag>
                ))}
              </BUITags>
            </YStack>
          </BUISection>
        </>
      )}
      {category === 'Selectors' && (
        <>
          <BUISection
            name="Secondary selector"
            measurement="H32 / R16 / secondary fill / horizontal12 / gap6 / optional leading icon16 / label14 Medium."
          >
            <YStack px={16}>
              <BUIActionSelector
                label="Choose wallet"
                variant="Secondary"
                items={wallets}
                selectedId={wallet}
                leadingIcon={<Wallet size={16} color={c.icon} />}
                onSelect={(item) => setWallet(item.id)}
              />
            </YStack>
          </BUISection>
          <BUISection
            name="Tertiary selector"
            measurement="H36 / R20 / neutral tertiary fill / horizontal16 / gap8 / switch icon16 / label14 Medium. Menu centered with12-point offset."
          >
            <YStack px={16}>
              <BUIActionSelector
                label="Choose currency"
                items={currencies}
                selectedId={currency}
                onSelect={(item) => setCurrency(item.id)}
              />
            </YStack>
          </BUISection>
          <BUISection
            name="Long menu & start alignment"
            measurement="Menu max width240 / R20 / raised surface. Rows48 / horizontal16 / label16 Medium / blue check16 / gap8. Separators0.5 inset16. Scrolls within the viewport."
          >
            <YStack px={16}>
              <BUIActionSelector
                label="Choose mint"
                alignment="start"
                items={mints}
                selectedId={mint}
                onSelect={(item) => setMint(item.id)}
              />
            </YStack>
          </BUISection>
          <BUISection
            name="Empty selector"
            measurement="No options: no popup. Trigger preserves its geometry."
          >
            <YStack px={16}>
              <BUIActionSelector label="Empty selector" items={[]} onSelect={() => {}} />
            </YStack>
          </BUISection>
          <BUISection
            name="Popup motion"
            measurement="Enter: scale .8→1 over120 ms, cubic(0,0,.2,1), alpha30 ms. Exit: alpha75 ms, scale snaps after74 ms. Reduced motion snaps both."
          >
            <YStack px={16}>
              <BUIText kind="body2" color={c.muted}>
                Inter and Lucide remain BUI’s fonts and icons. Native text metrics, ripple and popup
                focus need Android visual review.
              </BUIText>
            </YStack>
          </BUISection>
        </>
      )}
    </BUIPage>
  );
}
