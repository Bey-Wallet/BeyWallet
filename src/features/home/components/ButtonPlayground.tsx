import React, { useState } from 'react';
import { ArrowRight, Plus } from '@tamagui/lucide-icons';
import { Text, Theme, XStack, YStack } from 'tamagui';
import {
  AppButton,
  type AppButtonEmphasis,
  type AppButtonSize,
  type AppButtonVariant,
} from '~/shared/ui/AppButton';
import { AppPressable } from '~/shared/ui/AppPressable';

const variants: AppButtonVariant[] = ['default', 'branded', 'critical', 'warning'];
const emphases: AppButtonEmphasis[] = ['primary', 'secondary', 'tertiary', 'text-only'];
const sizes: AppButtonSize[] = ['xxsmall', 'xsmall', 'small', 'medium', 'large'];

function Examples() {
  const [previewTheme, setPreviewTheme] = useState<'light' | 'dark'>('light');
  const [state, setState] = useState('normal');
  const [manualLoading, setManualLoading] = useState(false);
  const [presses, setPresses] = useState(0);
  const [selected, setSelected] = useState(false);
  const disabled = state.includes('disabled');
  const loading = state.includes('loading');
  const onPress = () => setPresses((count) => count + 1);

  return (
    <Theme name={previewTheme}>
      <YStack bg="$background" p="$3" gap="$4" rounded={16}>
        <Text color="$color">Local theme preview</Text>
        <XStack gap="$2" flexWrap="wrap">
          {(['light', 'dark'] as const).map((name) => (
            <AppButton
              key={name}
              size="small"
              emphasis={previewTheme === name ? 'primary' : 'secondary'}
              onPress={() => setPreviewTheme(name)}
              accessibilityState={{ selected: previewTheme === name }}
            >
              {name}
            </AppButton>
          ))}
        </XStack>
        <Text color="$color">Example state</Text>
        <XStack gap="$2" flexWrap="wrap">
          {['normal', 'disabled', 'loading', 'loading + disabled'].map((name) => (
            <AppButton
              key={name}
              size="small"
              emphasis={state === name ? 'primary' : 'secondary'}
              onPress={() => setState(name)}
              accessibilityState={{ selected: state === name }}
            >
              {name}
            </AppButton>
          ))}
        </XStack>
        <Text color="$color" accessibilityLiveRegion="polite">{`Press count: ${presses}`}</Text>
        {variants.map((variant) => (
          <YStack key={variant} gap="$3">
            {emphases.map((emphasis) => (
              <AppButton
                key={emphasis}
                variant={variant}
                emphasis={emphasis}
                loading={loading}
                disabled={disabled}
                onPress={onPress}
              >
                {`${variant === 'critical' ? 'Delete example' : variant === 'warning' ? 'Review warning' : variant} / ${emphasis}`}
              </AppButton>
            ))}
          </YStack>
        ))}
        <Text color="$color">Sizes (small targets have additional hit slop)</Text>
        <YStack gap="$4" items="flex-start">
          {sizes.map((size) => (
            <AppButton
              key={size}
              size={size}
              icon={Plus}
              loading={loading}
              disabled={disabled}
              onPress={onPress}
            >
              {size}
            </AppButton>
          ))}
        </YStack>
        <AppButton
          icon={Plus}
          iconAfter={ArrowRight}
          loading={loading}
          disabled={disabled}
          onPress={onPress}
        >
          Leading and trailing icons
        </AppButton>
        <Text color="$color">Icon-only actions and selected controls</Text>
        <XStack gap="$3" items="center">
          <AppButton
            variant="branded"
            emphasis="primary"
            iconOnly
            icon={Plus}
            size="large"
            accessibilityLabel="Add example"
            loading={loading}
            disabled={disabled}
            onPress={onPress}
          />
          <AppButton
            variant="default"
            emphasis="secondary"
            iconOnly
            icon={ArrowRight}
            shape="circular"
            accessibilityLabel="Next example"
            loading={loading}
            disabled={disabled}
            onPress={onPress}
          />
          <AppPressable
            minHeight={48}
            px="$3"
            rounded={12}
            bg={selected ? '$blue4' : '$gray3'}
            accessibilityState={{ selected }}
            disabled={disabled || loading}
            onPress={() => setSelected((value) => !value)}
          >
            <Text color="$color">{selected ? 'Selected filter' : 'Select filter'}</Text>
          </AppPressable>
        </XStack>
        <AppButton
          fullWidth
          loading={loading}
          disabled={disabled}
          loadingText="Preparing example…"
          onPress={onPress}
        >
          Full width with loading text
        </AppButton>
        <AppButton fullWidth loading={loading} disabled={disabled} onPress={onPress}>
          This long example label wraps on small screens and grows with your accessibility text size
        </AppButton>
        <AppButton
          fullWidth
          labelFontSize={32}
          loading={loading}
          disabled={disabled}
          onPress={onPress}
        >
          Large text preview
        </AppButton>
        <AppButton
          emphasis="secondary"
          onPress={() => setManualLoading((value) => !value)}
          accessibilityState={{ expanded: manualLoading }}
        >
          {manualLoading ? 'Stop manual loading' : 'Start manual loading'}
        </AppButton>
        <AppButton loading={manualLoading} icon={Plus} onPress={onPress}>
          Manually controlled loading
        </AppButton>
      </YStack>
    </Theme>
  );
}

export default function ButtonPlayground() {
  const [expanded, setExpanded] = useState(false);
  return (
    <YStack width="100%" gap="$3">
      <AppButton
        emphasis="secondary"
        fullWidth
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((value) => !value)}
      >
        {expanded ? 'Hide button playground' : 'Show button playground (development)'}
      </AppButton>
      {expanded ? <Examples /> : null}
    </YStack>
  );
}
