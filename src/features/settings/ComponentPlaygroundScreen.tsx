import React, { useCallback, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Info,
  Plus,
  ShieldCheck,
  Wallet,
  X,
} from '@tamagui/lucide-icons';
import { Text, Theme, XStack, YStack } from 'tamagui';
import { AppButton, type AppButtonSize, type AppButtonVariant } from '~/shared/ui/AppButton';
import { AppIconButton } from '~/shared/ui/AppIconButton';
import { AppTextButton } from '~/shared/ui/AppTextButton';
import { AppPressable } from '~/shared/ui/AppPressable';
import { AppSwitch } from '~/shared/ui/AppSwitch';
import { HeaderIconButton } from '~/shared/ui/HeaderIconButton';
import { ListTable, ListTableRow, type ListTableVariant } from '~/shared/ui/ListTable';
import { MintBalanceRow } from '~/shared/ui/MintBalanceRow';
import GlowCard from '~/shared/ui/GlowCard';
import { PromptCardStack } from '~/features/home/components/PromptCardStack';
import { ConversationItemCard } from '~/features/people/components/ConversationItemCard';
import type { ConversationActivity } from '~/features/people/conversationActivity';
import { appTypography } from '~/shared/theme/appearance';
import {
  SettingsDescription,
  SettingsGroup,
  SettingsPage,
  SettingsRow,
} from './components/SettingsLayout';

const variants: readonly AppButtonVariant[] = ['default', 'critical', 'warning'];
const emphases = ['primary', 'secondary', 'ghost', 'text'] as const;
const sizes: readonly AppButtonSize[] = ['xxsmall', 'xsmall', 'small', 'medium', 'large'];
type SampleAction = (label: string) => void;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <YStack gap="$3">
      <Text {...appTypography.label2} color="$color" accessibilityRole="header">
        {title}
      </Text>
      {children}
    </YStack>
  );
}

function Choices<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <YStack gap="$2" accessibilityLabel={label}>
      <Text {...appTypography.body3} color="$gray10">
        {label}
      </Text>
      <XStack gap="$2" flexWrap="wrap">
        {options.map((option) => (
          <AppPressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityLabel={`${label}: ${option.label}`}
            accessibilityState={{ checked: value === option.value }}
            onPress={() => onChange(option.value)}
            minHeight={48}
            px="$3"
            py="$2"
            rounded="$5"
            bg={value === option.value ? '$gray3' : '$buttonDefaultSecondary'}
            pressStyle={{ bg: '$buttonDefaultSecondaryPress' }}
            flexDirection="row"
            items="center"
            gap="$2"
          >
            {value === option.value && <Check size={14} color="$color" aria-hidden />}
            <Text {...appTypography.label2} color="$color">
              {option.label}
            </Text>
          </AppPressable>
        ))}
      </XStack>
    </YStack>
  );
}

function ButtonSamples({ record }: { record: SampleAction }) {
  const [size, setSize] = useState<AppButtonSize>('medium');
  const [state, setState] = useState<'normal' | 'disabled' | 'loading' | 'loading-disabled'>(
    'normal',
  );
  const [icons, setIcons] = useState<'none' | 'leading' | 'trailing' | 'both'>('leading');
  const [shape, setShape] = useState<'rounded' | 'circular'>('rounded');
  const [fullWidth, setFullWidth] = useState(false);
  const [longLabel, setLongLabel] = useState(false);
  const disabled = state === 'disabled' || state === 'loading-disabled';
  const loading = state === 'loading' || state === 'loading-disabled';
  const label = longLabel ? 'Preview a longer action label' : 'Preview action';
  return (
    <>
      <Choices
        label="Size"
        options={sizes.map((value) => ({ value, label: value }))}
        value={size}
        onChange={setSize}
      />
      <Choices
        label="State"
        options={[
          { value: 'normal', label: 'Normal' },
          { value: 'disabled', label: 'Disabled' },
          { value: 'loading', label: 'Loading' },
          { value: 'loading-disabled', label: 'Loading + disabled' },
        ]}
        value={state}
        onChange={setState}
      />
      <Choices
        label="Button icons"
        options={[
          { value: 'none', label: 'None' },
          { value: 'leading', label: 'Leading' },
          { value: 'trailing', label: 'Trailing' },
          { value: 'both', label: 'Both' },
        ]}
        value={icons}
        onChange={setIcons}
      />
      <SettingsGroup>
        <AppSwitch
          variant="branded"
          checked={fullWidth}
          onCheckedChange={setFullWidth}
          accessibilityLabel="Full-width button previews"
        >
          <Text {...appTypography.label2} color="$color">
            Full width
          </Text>
        </AppSwitch>
        <AppSwitch
          variant="branded"
          checked={longLabel}
          onCheckedChange={setLongLabel}
          accessibilityLabel="Long button labels"
        >
          <Text {...appTypography.label2} color="$color">
            Long labels
          </Text>
        </AppSwitch>
      </SettingsGroup>
      {variants.map((variant) => (
        <Section key={variant} title={`${variant} buttons`}>
          {emphases.map((emphasis) => (
            <YStack key={emphasis} gap="$2" items={fullWidth ? 'stretch' : 'flex-start'}>
              <Text {...appTypography.body3} color="$gray10">
                {emphasis}
              </Text>
              <AppButton
                variant={variant}
                emphasis={emphasis}
                size={size}
                disabled={disabled}
                loading={loading}
                loadingText={`Loading sample ${variant} ${emphasis}`}
                fullWidth={fullWidth}
                icon={icons === 'leading' || icons === 'both' ? Plus : undefined}
                iconAfter={icons === 'trailing' || icons === 'both' ? ArrowRight : undefined}
                accessibilityLabel={`Sample ${variant} ${emphasis} button`}
                onPress={() => record(`${variant} / ${emphasis} / ${size}`)}
              >
                {label}
              </AppButton>
            </YStack>
          ))}
        </Section>
      ))}
      <Section title="Icon buttons">
        <Choices
          label="Icon button shape"
          options={[
            { value: 'rounded', label: 'Rounded' },
            { value: 'circular', label: 'Circular' },
          ]}
          value={shape}
          onChange={setShape}
        />
        {variants.map((variant) => (
          <YStack key={variant} gap="$2">
            <Text {...appTypography.body3} color="$gray10">
              {variant}: primary · secondary · ghost · text
            </Text>
            <XStack gap="$3" flexWrap="wrap">
              {emphases.map((emphasis) => (
                <AppIconButton
                  key={emphasis}
                  variant={variant}
                  emphasis={emphasis}
                  size={size}
                  shape={shape}
                  icon={Plus}
                  disabled={disabled}
                  loading={loading}
                  accessibilityLabel={`Sample ${variant} ${emphasis} icon button`}
                  onPress={() => record(`${variant} / ${emphasis} icon / ${size} / ${shape}`)}
                />
              ))}
            </XStack>
          </YStack>
        ))}
      </Section>
      <Section title="Header controls">
        <XStack gap="$3" flexWrap="wrap">
          <HeaderIconButton
            icon={ArrowLeft}
            accessibilityLabel="Sample back control"
            disabled={disabled}
            loading={loading}
            onPress={() => record('Header back control')}
          />
          <HeaderIconButton
            icon={X}
            accessibilityLabel="Sample close control"
            disabled={disabled}
            loading={loading}
            onPress={() => record('Header close control')}
          />
        </XStack>
      </Section>
      <Section title="Background-free text actions">
        <SettingsDescription>
          Custom colors, no fill or underline. These buttons support normal and disabled states.
        </SettingsDescription>
        <XStack gap="$3" flexWrap="wrap">
          <AppTextButton disabled={disabled} onPress={() => record('Text action: default')}>
            Default
          </AppTextButton>
          <AppTextButton
            color="$toastAction"
            disabled={disabled}
            onPress={() => record('Text action: accent')}
          >
            Accent
          </AppTextButton>
          <AppTextButton
            color="$red10"
            disabled={disabled}
            onPress={() => record('Text action: error')}
          >
            Error
          </AppTextButton>
          <AppTextButton
            color="#8B5CF6"
            disabled={disabled}
            onPress={() => record('Text action: custom color')}
          >
            Custom color
          </AppTextButton>
        </XStack>
      </Section>
    </>
  );
}

function TableSamples({ record }: { record: SampleAction }) {
  const [compact, setCompact] = useState(true);
  const [tableVariant, setTableVariant] = useState<ListTableVariant>('filled');
  const [enabled, setEnabled] = useState(true);
  const [selected, setSelected] = useState('first');
  return (
    <>
      <Choices
        label="Table density"
        options={[
          { value: 'compact', label: 'Compact' },
          { value: 'standard', label: 'Standard' },
        ]}
        value={compact ? 'compact' : 'standard'}
        onChange={(value) => setCompact(value === 'compact')}
      />
      <Choices
        label="Table style"
        options={[
          { value: 'filled', label: 'Filled' },
          { value: 'outlined', label: 'Outlined' },
        ]}
        value={tableVariant}
        onChange={setTableVariant}
      />
      <Section title="ListTable rows">
        <SettingsDescription>
          Read-only, numeric, copyable, actionable, disabled, custom content, and wrapping. Copy
          uses sample text.
        </SettingsDescription>
        <ListTable compact={compact} variant={tableVariant}>
          <ListTableRow label="Read-only value" value="Sample mint" icon={Wallet} />
          <ListTableRow label="Zero value" value={0} />
          <ListTableRow
            label="Copy sample text"
            value="Bey sample"
            isCopyable
            copyValue="Bey component playground sample"
          />
          <ListTableRow
            label="Action row"
            value="Preview"
            icon={Info}
            onPress={() => record('ListTable action row')}
          />
          <ListTableRow
            label="Disabled action"
            value="Unavailable"
            disabled
            onPress={() => record('Disabled row should not fire')}
          />
          <ListTableRow label="Disabled copy" value="Sample" disabled isCopyable />
          <ListTableRow label="Positive value" value="Confirmed" valueColor="$green10" />
          <ListTableRow label="Warning value" value="Review needed" valueColor="$orange10" />
          <ListTableRow
            label="Custom content"
            rightContent={
              <AppSwitch
                checked={enabled}
                onCheckedChange={setEnabled}
                accessibilityLabel="Sample table switch"
                variant="branded"
              />
            }
          />
          <ListTableRow
            label="A longer label to test wrapping on a narrow screen"
            value="A longer sample value that should remain readable with larger text"
            multiline
          />
          <ListTableRow
            label="Trailing icon"
            value="Selected"
            iconAfter={<Check size={18} color="$green10" />}
          />
        </ListTable>
      </Section>
      <Section title="Payment mint and balance">
        <MintBalanceRow
          displayName="Sample mint"
          balance={2100}
          onPress={() => record('Sample mint selector')}
          showMax
          onMaxPress={() => record('Sample maximum amount')}
        />
        <SettingsDescription>
          The same compact rows are used for payment mint selectors and available balances.
        </SettingsDescription>
        <ListTable variant={tableVariant}>
          {['1 block', '3 blocks'].map((label) => (
            <ListTableRow
              key={label}
              label={label}
              value={label === '1 block' ? '12 sat' : '6 sat'}
              selected={selected === label}
              onPress={() => {
                setSelected(label);
                record(`Sample confirmation speed: ${label}`);
              }}
              rightContent={
                <XStack width={20}>
                  {selected === label ? <Check size={20} color="$color" /> : null}
                </XStack>
              }
            />
          ))}
        </ListTable>
      </Section>
      <Section title="Settings rows and groups">
        <SettingsGroup>
          <SettingsRow title="Read-only status" icon={Info} value="Available" />
          <SettingsRow
            title="Navigation row"
            icon={Wallet}
            description="Sample destination"
            onPress={() => record('Settings navigation sample')}
          />
          <SettingsRow
            title="External destination (sample)"
            icon={Info}
            external
            onPress={() => record('External-link sample; no link opened')}
          />
          <SettingsRow
            title="Destructive action (sample)"
            icon={X}
            destructive
            onPress={() => record('Destructive sample; nothing deleted')}
          />
          <SettingsRow
            title="Disabled row"
            disabled
            onPress={() => record('Disabled Settings row should not fire')}
          />
        </SettingsGroup>
        <SettingsGroup>
          {['first', 'second'].map((value) => (
            <SettingsRow
              key={value}
              title={`${value} option`}
              selected={selected === value}
              onPress={() => {
                setSelected(value);
                record(`Selected ${value} option`);
              }}
            />
          ))}
        </SettingsGroup>
      </Section>
    </>
  );
}

const sampleActivities: readonly ConversationActivity[] = [
  {
    id: 'sample-incoming',
    kind: 'text',
    direction: 'incoming',
    text: 'A sample incoming message.',
    status: 'Received',
    time: 1,
    requiresAction: false,
  },
  {
    id: 'sample-outgoing',
    kind: 'text',
    direction: 'outgoing',
    text: 'A sample outgoing message.',
    status: 'Sent to relay',
    time: 2,
    requiresAction: false,
  },
  {
    id: 'sample-sending',
    kind: 'text',
    direction: 'outgoing',
    text: 'Sending a sample message…',
    status: 'Sending',
    time: 3,
    requiresAction: false,
  },
  {
    id: 'sample-failed',
    kind: 'text',
    direction: 'outgoing',
    text: 'A sample failure state.',
    status: 'Failed',
    time: 4,
    requiresAction: false,
  },
  {
    id: 'sample-payment',
    kind: 'payment',
    direction: 'incoming',
    type: 'Ecash',
    amount: 21,
    note: 'Sample payment only',
    status: 'Received',
    time: 5,
    requiresAction: false,
  },
  {
    id: 'sample-review',
    kind: 'payment',
    direction: 'incoming',
    type: 'Ecash request',
    amount: 21,
    note: 'Sample review state',
    status: 'Review needed',
    time: 6,
    requiresAction: true,
  },
  {
    id: 'sample-sent',
    kind: 'payment',
    direction: 'outgoing',
    type: 'Lightning',
    amount: 21,
    status: 'Pending',
    time: 7,
    requiresAction: false,
  },
  {
    id: 'sample-payment-failed',
    kind: 'payment',
    direction: 'outgoing',
    type: 'Lightning',
    amount: 21,
    status: 'Failed',
    time: 8,
    requiresAction: false,
  },
];

function CardSamples({ record }: { record: SampleAction }) {
  const { width } = useWindowDimensions();
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [payDisabled, setPayDisabled] = useState(false);
  return (
    <>
      <Section title="Home prompt cards">
        <SettingsDescription>
          Swipe or dismiss these sample prompts. Reset restores them locally.
        </SettingsDescription>
        <PromptCardStack
          cards={[
            {
              id: 'backup',
              title: 'Sample backup prompt',
              description: 'Preview the real Home prompt card layout.',
              icon: <ShieldCheck size={22} color="$color" />,
            },
            {
              id: 'username',
              title: 'Sample username prompt',
              description: 'A second prompt to test stacking and gestures.',
              icon: <Info size={22} color="$color" />,
            },
          ]
            .filter((card) => !dismissed.includes(card.id))
            .map((card) => ({
              ...card,
              onPress: () => record(card.title),
              onDismiss: () => {
                setDismissed((previous) => [...previous, card.id]);
                record(`Dismissed ${card.title}`);
              },
            }))}
        />
        <AppButton
          variant="default"
          emphasis="secondary"
          size="small"
          onPress={() => {
            setDismissed([]);
            record('Reset sample prompts');
          }}
        >
          Reset sample prompts
        </AppButton>
      </Section>
      <Section title="Conversation cards and bubbles">
        <SettingsDescription>
          Incoming, outgoing, sending, failed, received, review, and pending examples. All amounts
          are sample values.
        </SettingsDescription>
        <AppSwitch
          checked={payDisabled}
          onCheckedChange={setPayDisabled}
          variant="branded"
          accessibilityLabel="Disable sample card action"
        >
          <Text {...appTypography.label2} color="$color">
            Disable sample card action
          </Text>
        </AppSwitch>
        <YStack gap="$3">
          {sampleActivities.map((item) => (
            <ConversationItemCard
              key={item.id}
              item={item}
              primaryAmount={item.kind === 'payment' ? '21 sat' : undefined}
              onPress={() => record(`${item.kind} card: ${item.status}`)}
              onPay={
                item.requiresAction
                  ? () => record('Sample card action; no payment submitted')
                  : undefined
              }
              payDisabled={payDisabled}
            />
          ))}
        </YStack>
      </Section>
      <Section title="Onboarding glow card">
        <YStack items="center">
          <GlowCard width={Math.min(360, Math.max(120, width - 32))} height={180}>
            <YStack flex={1} p="$4" justify="center" gap="$2">
              <Text fontSize={16} fontWeight="600" color="white">
                Sample glow card
              </Text>
              <Text fontSize={12} color="white">
                The existing onboarding surface with sample content.
              </Text>
            </YStack>
          </GlowCard>
        </YStack>
      </Section>
    </>
  );
}

export function ComponentPlaygroundScreen() {
  const [section, setSection] = useState<'buttons' | 'tables' | 'cards'>('buttons');
  const [appearance, setAppearance] = useState<'app' | 'light' | 'dark'>('app');
  const [lastAction, setLastAction] = useState('No sample action yet');
  const [count, setCount] = useState(0);
  const insets = useSafeAreaInsets();
  const record = useCallback((label: string) => {
    setLastAction(label);
    setCount((value) => value + 1);
  }, []);
  return (
    <Theme name={appearance === 'app' ? undefined : appearance}>
      <YStack flex={1} bg="$background">
        <SettingsPage>
          <SettingsDescription>
            Explore the actual app components using sample content. Actions stay on this page; copy
            rows copy sample text.
          </SettingsDescription>
          <SettingsDescription>
            Corners: buttons, cards and groups 16 pt · inputs 12 pt · sheets 20 pt. Circular
            controls and toast pills keep their intentional shapes.
          </SettingsDescription>
          <Choices
            label="Preview theme"
            options={[
              { value: 'app', label: 'App' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
            value={appearance}
            onChange={setAppearance}
          />
          <Choices
            label="Components"
            options={[
              { value: 'buttons', label: 'Buttons' },
              { value: 'tables', label: 'List tables' },
              { value: 'cards', label: 'Cards' },
            ]}
            value={section}
            onChange={setSection}
          />
          {section === 'buttons' ? (
            <ButtonSamples record={record} />
          ) : section === 'tables' ? (
            <TableSamples record={record} />
          ) : (
            <CardSamples record={record} />
          )}
        </SettingsPage>
        <YStack px="$4" pt="$3" pb={Math.max(insets.bottom, 12)} bg="$buttonDefaultSecondary">
          <Text
            fontSize={12}
            color="$gray10"
            accessibilityLiveRegion="polite"
          >{`${count} sample actions · ${lastAction}`}</Text>
        </YStack>
      </YStack>
    </Theme>
  );
}
