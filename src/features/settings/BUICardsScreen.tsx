import React, { useState } from 'react';
import { useWindowDimensions } from 'react-native';
import { Bell, Check, Fingerprint, KeyRound, Wallet } from '@tamagui/lucide-icons';
import { XStack, YStack } from 'tamagui';
import {
  BUIPage,
  BUISection,
  BUIChoices,
  BUIText,
  BUIAvatar,
  BUIBadgedAvatar,
  BUILabel,
  BUIIcon,
  BUIButton,
  BUIPropertyRow,
  BUICard,
  BUICardRow,
  BUIWarningCard,
  BUISetupCard,
  BUIMoreItemsCard,
  BUIHiddenItemsCard,
  BUICardShelf,
  BUIShelfCard,
  BUICollectibleCard,
  BUISeeAllCard,
  BUIBannerCard,
  useBUITheme,
} from '~/shared/ui/BUI';
import { useBUIStore } from '~/state/buiStore';

const categories = ['Foundation', 'Wallet', 'Setup', 'Shelves', 'Banners'] as const;

export function BUICardsScreen() {
  const c = useBUITheme();
  const appearance = useBUIStore((state) => state.appearance);
  const [category, setCategory] = useState<(typeof categories)[number]>('Foundation');
  const [notice, setNotice] = useState('All data and actions are local preview samples.');
  const [selected, setSelected] = useState('Everyday wallet');
  const [backup, setBackup] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const [biometrics, setBiometrics] = useState(false);
  const [setupHidden, setSetupHidden] = useState(false);
  const [editing, setEditing] = useState(false);
  const [removed, setRemoved] = useState<string[]>([]);
  const [hidden, setHidden] = useState(false);
  const [bannerHidden, setBannerHidden] = useState(false);
  const [textBannerHidden, setTextBannerHidden] = useState(false);
  const [assetState, setAssetState] = useState<'Default' | 'Selected' | 'Expanded'>('Default');
  const { width } = useWindowDimensions();
  const collectibleWidth = Math.max(48, (width - 48) / 3);
  const press = () => setNotice('Sample card pressed.');
  const avatar = (initials: string, size = 44, badge?: number) =>
    badge ? (
      <BUIBadgedAvatar
        initials={initials}
        size={size}
        label=""
        badge={<BUIAvatar initials="L" size={badge} label="" />}
      />
    ) : (
      <BUIAvatar initials={initials} size={size} label="" />
    );
  return (
    <BUIPage
      title="BUI / Cards"
      status={notice}
      controls={<BUIChoices values={categories} value={category} onChange={setCategory} />}
    >
      {category === 'Foundation' && (
        <>
          <BUISection
            name="Card surface"
            measurement="Corners16 / outer margins16 / card surface / optional padding16. No default border or shadow. Width follows the parent."
          >
            <BUICard padding={16}>
              <YStack gap={8}>
                <BUIText>Standalone content island</BUIText>
                <BUIText kind="body2" color={c.muted}>
                  Arbitrary content inside the shared card container.
                </BUIText>
              </YStack>
            </BUICard>
            <BUICard padding={16} onPress={press} label="Interactive card">
              <YStack gap={8}>
                <BUIText>Interactive card</BUIText>
                <BUIText kind="body2" color={c.muted}>
                  The whole card is one touch target.
                </BUIText>
              </YStack>
            </BUICard>
            <BUICard padding={16} onPress={press} disabled label="Disabled card">
              <BUIText>Disabled card</BUIText>
            </BUICard>
          </BUISection>
          <BUISection
            name="First, middle & last"
            measurement="First clips top corners, middle stays square, last clips bottom corners. Dividers0.5 / start16 overlay the row without adding height."
          >
            <YStack>
              {(['first', 'middle', 'last'] as const).map((position) => (
                <BUICardRow
                  key={position}
                  title={position}
                  subtitle="One continuous card group"
                  position={position}
                  leading={avatar('B', 36)}
                  onPress={press}
                  destination="internal"
                />
              ))}
            </YStack>
          </BUISection>
          <BUISection
            name="Content variants"
            measurement="Minimum76 / inner padding16 × 8 / title16 Medium / subtitle14 Regular / leading gap16 / trailing gap8 / tags gap8."
          >
            <BUICardRow title="Plain card" subtitle="No image or trailing content" />
            <BUICardRow
              title="Card with image"
              subtitle="Optional navigation"
              leading={avatar('B', 36)}
              destination="internal"
              onPress={press}
            />
            <BUICardRow
              title="Tagged card"
              subtitle="Trailing value slot"
              tags={<BUILabel>New</BUILabel>}
              leading={avatar('B', 36)}
              value="12.50"
              onPress={press}
            />
          </BUISection>
          <BUISection
            name="Warning card"
            measurement="Corners16 / padding16 × 12 / primary body14/20, max3 lines / trailing warning icon16 in secondary tone / gap16."
          >
            <BUIWarningCard>
              Keep a recovery backup somewhere safe. This is a design sample with no wallet
              information.
            </BUIWarningCard>
          </BUISection>
          <BUISection
            name="Summary composition"
            measurement="Shared card with padding16 and existing property rows. Actions use BUI buttons, including the softer secondary fill in light mode."
          >
            <BUICard padding={16}>
              <YStack gap={16}>
                <BUIText kind="h3">Sample balance</BUIText>
                <BUIText kind="num1">12,500 sats</BUIText>
                <BUIText kind="body2" color={c.muted}>
                  $8.12 · synthetic values
                </BUIText>
                <XStack gap={12} flexWrap="wrap">
                  <BUIButton appearance={appearance} onPress={press}>
                    Receive
                  </BUIButton>
                  <BUIButton appearance={appearance} variant="Secondary" onPress={press}>
                    Transfer
                  </BUIButton>
                </XStack>
              </YStack>
            </BUICard>
          </BUISection>
        </>
      )}
      {category === 'Wallet' && (
        <>
          <BUISection
            name="Wallet selection"
            measurement="Minimum76 / avatar44 / title16 Medium / subtitle14 / selected blue check28. Whole-row radio selection."
          >
            <YStack>
              {['Everyday wallet', 'Travel wallet'].map((title, index) => (
                <BUICardRow
                  key={title}
                  position={index ? 'last' : 'first'}
                  title={title}
                  subtitle={index ? 'Secondary wallet' : 'Everyday use'}
                  leading={avatar(index ? 'T' : 'B')}
                  role="radio"
                  checked={selected === title}
                  trailing={selected === title ? <Check size={28} color={c.primary} /> : undefined}
                  onPress={() => setSelected(title)}
                />
              ))}
            </YStack>
          </BUISection>
          <BUISection
            name="Asset card states"
            measurement="Minimum76 / avatar44 / badge18 / title-tag gap8 / check28 or navigation chevron16. Expanded denotes a navigable asset option."
          >
            <YStack px={16}>
              <BUIChoices
                values={['Default', 'Selected', 'Expanded'] as const}
                value={assetState}
                onChange={setAssetState}
              />
            </YStack>
            <BUICardRow
              title="Bitcoin"
              subtitle="Sample asset"
              tags={<BUILabel>Cash</BUILabel>}
              leading={avatar('B', 44, 18)}
              trailing={
                assetState === 'Selected' ? (
                  <BUIIcon name="check" size={28} tone="accent" />
                ) : undefined
              }
              destination={assetState === 'Expanded' ? 'internal' : undefined}
              onPress={press}
            />
          </BUISection>
          <BUISection
            name="More assets & hidden items"
            measurement="More row minimum60 / padding16 × 12 / previews24 with2 ring / overlap8 / max2 / title gap12 / chevron gap4. Hidden row minimum76 / circle44 / icon28 / no text gap."
          >
            <BUIMoreItemsCard previews={['B', 'U', 'E']} onPress={press} />
            <BUIHiddenItemsCard
              title="All assets hidden"
              subtitle="Manage your sample assets"
              onPress={press}
            />
            <BUIHiddenItemsCard
              title="All collectibles hidden"
              subtitle="Manage your sample collectibles"
              onPress={press}
            />
          </BUISection>
          <BUISection
            name="Read-only value card"
            measurement="A content composition using existing property rows; wallet formatting and operations stay outside the UI component."
          >
            <BUICard>
              <BUIPropertyRow title="Mint" value="Everyday mint" />
              <BUIPropertyRow title="Available" value="12,500 sats" />
              <BUIPropertyRow title="Pending" value="0 sats" />
            </BUICard>
          </BUISection>
        </>
      )}
      {category === 'Setup' && (
        <>
          <BUISection
            name="Finish setup"
            measurement="Group corners16 / rows padding16 / icon circle44 with12% semantic tint / glyph28 / title14/20 / content gap16. Completed title alpha72%, check22. Switches are visual only; each row is one action."
          >
            <YStack px={16}>
              <BUIChoices
                values={['Pending', 'Complete', 'Reset'] as const}
                value={backup ? 'Complete' : 'Pending'}
                onChange={(value) => {
                  setBackup(value === 'Complete');
                  if (value === 'Reset') {
                    setNotifications(false);
                    setBiometrics(false);
                    setSetupHidden(false);
                  }
                }}
              />
            </YStack>
            {setupHidden ? (
              <BUICardRow title="Restore setup preview" onPress={() => setSetupHidden(false)} />
            ) : (
              <BUISetupCard
                onSkip={() => setSetupHidden(true)}
                items={[
                  {
                    id: 'backup',
                    title: 'Back up wallet',
                    tone: 'warning',
                    icon: <KeyRound size={28} color={c.warning} />,
                    status: backup ? 'complete' : 'pending',
                    onPress: () => setBackup(true),
                  },
                  {
                    id: 'notifications',
                    title: 'Enable notifications',
                    tone: 'success',
                    icon: <Bell size={28} color={c.positive} />,
                    checked: notifications,
                    onPress: () => setNotifications(!notifications),
                  },
                  {
                    id: 'biometrics',
                    title: 'Enable biometrics',
                    tone: 'success',
                    icon: <Fingerprint size={28} color={c.positive} />,
                    checked: biometrics,
                    onPress: () => setBiometrics(!biometrics),
                  },
                  {
                    id: 'migration',
                    title: 'Migrate sample wallets',
                    description: '2 sample wallets left',
                    tone: 'primary',
                    icon: <Wallet size={28} color={c.primary} />,
                    onPress: press,
                  },
                ]}
              />
            )}
          </BUISection>
          <BUIWarningCard>
            Setup actions only change this preview. No permissions, authentication or wallet backup
            runs.
          </BUIWarningCard>
        </>
      )}
      {category === 'Shelves' && (
        <>
          <BUISection
            name="Compact shelf cards"
            measurement="Width100 / corners16 / padding10 sides,16 top,14 bottom / avatar44 + badge20 / text12 Regular / gaps10,2,1. Yield values are layout samples."
          >
            <BUICardShelf>
              {['USD', 'Bitcoin', 'Ethereum'].map((title, index) => (
                <BUIShelfCard
                  key={title}
                  title={title}
                  subtitle={['6.74% APY', '3.58% APY', '3.41% APY'][index]}
                  detail="Sample protocol"
                  avatar={avatar(title.slice(0, 1), 44, 20)}
                  onPress={press}
                />
              ))}
            </BUICardShelf>
          </BUISection>
          <BUISection
            name="Collectible preview cards"
            measurement="Width=(viewport − 48)/3 / corners16 / square art / text padding12 × 8 / title14 Medium / collection12 Regular. Sale badge26 inset8. Artwork uses a local placeholder."
          >
            <YStack px={16}>
              <BUIChoices
                values={['Visible', 'Hidden'] as const}
                value={hidden ? 'Hidden' : 'Visible'}
                onChange={(value) => setHidden(value === 'Hidden')}
              />
            </YStack>
            <BUICardShelf>
              {['One', 'Two', 'Three'].map((title, index) => (
                <BUICollectibleCard
                  key={title}
                  title={`Item ${title}`}
                  collection="Sample collection"
                  width={collectibleWidth}
                  hidden={hidden}
                  sale={index === 0}
                  onPress={press}
                />
              ))}
              <BUISeeAllCard width={collectibleWidth} onPress={press} />
            </BUICardShelf>
          </BUISection>
          <BUISection
            name="Favorite cards"
            measurement="Width100 / corners12 / padding8 × 16 / avatar56 + badge20 / text12 / gaps8,1. Edit/remove glyph16 inside24 circle, offset4, touch48. Removal collapses/fades300 ms; reduced motion removes immediately."
          >
            <YStack px={16}>
              <BUIChoices
                values={['Normal', 'Editing', 'Reset'] as const}
                value={editing ? 'Editing' : 'Normal'}
                onChange={(value) => {
                  setEditing(value === 'Editing');
                  if (value === 'Reset') setRemoved([]);
                }}
              />
            </YStack>
            <BUICardShelf>
              {['Bitcoin', 'Ethereum', 'USD']
                .filter((title) => !removed.includes(title))
                .map((title, index) => (
                  <BUIShelfCard
                    key={title}
                    variant="favorite"
                    title={title}
                    subtitle={index === 1 ? '−2.14%' : '+4.37%'}
                    positive={index !== 1}
                    avatar={avatar(title.slice(0, 1), 56, 20)}
                    editing={editing}
                    onPress={press}
                    onRemove={() => setRemoved((current) => [...current, title])}
                  />
                ))}
            </BUICardShelf>
          </BUISection>
        </>
      )}
      {category === 'Banners' && (
        <>
          <BUISection
            name="Dismissible banner"
            measurement="Height90 / corners20 / border1 in neutral tertiary fill / title14 Medium, max2 lines / action12 Regular at64% alpha / gap4 / image slot134. Close layout54 × 44, circle24 / icon16."
          >
            {bannerHidden ? (
              <BUICardRow title="Restore banner" onPress={() => setBannerHidden(false)} />
            ) : (
              <BUIBannerCard
                title="A better way to use your wallet"
                action="Explore preview"
                artwork={<Wallet size={48} color={c.primary} />}
                onPress={() => setNotice('Banner action pressed. No destination opened.')}
                onDismiss={() => {
                  setBannerHidden(true);
                  setNotice('Banner dismissed.');
                }}
              />
            )}
          </BUISection>
          <BUISection
            name="Text-only banner"
            measurement="Same shell without the illustration. Text reserves room for the independent close control; large text may grow the card."
          >
            {textBannerHidden ? (
              <BUICardRow title="Restore text banner" onPress={() => setTextBannerHidden(false)} />
            ) : (
              <BUIBannerCard
                title="Try another part of the BUI playground"
                action="View components"
                onPress={press}
                onDismiss={() => setTextBannerHidden(true)}
              />
            )}
          </BUISection>
          <BUIWarningCard>
            Illustrations are Lucide placeholders. Inter, native text layout and press feedback
            differ from the source and need Android visual review.
          </BUIWarningCard>
        </>
      )}
    </BUIPage>
  );
}
