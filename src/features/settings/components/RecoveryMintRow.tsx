import React from 'react';
import { CheckCircle2, AlertCircle } from '@tamagui/lucide-icons';
import { XStack, YStack } from 'tamagui';
import { AppPressable } from '~/shared/ui/AppPressable';
import { AppText } from '~/shared/ui/AppText';
import { BUICheckboxVisual } from '~/shared/ui/BUI/BUISelectionControl';
import { appDimensions, appSpacing } from '~/shared/theme';

export type RecoveryMintStatus =
  'ready' | 'queued' | 'scanning' | 'done' | 'partial' | 'error' | 'interrupted';

export function RecoveryMintRow({
  name,
  url,
  selected,
  disabled,
  status,
  balance,
  onToggle,
}: {
  name: string;
  url: string;
  selected: boolean;
  disabled: boolean;
  status: RecoveryMintStatus;
  balance: number;
  onToggle: () => void;
}) {
  const hostname = url.replace(/^https?:\/\//, '');
  const hasResult = selected && ['done', 'partial', 'error', 'interrupted'].includes(status);
  const label = !selected
    ? 'Not selected'
    : status === 'done'
      ? balance > 0
        ? 'Recovered'
        : 'No available funds'
      : status === 'scanning'
        ? 'Recovering…'
        : status === 'queued'
          ? 'Waiting…'
          : status === 'partial'
            ? 'Incomplete'
            : status === 'error'
              ? 'Could not finish'
              : status === 'interrupted'
                ? 'Interrupted'
                : 'Selected';
  const tone =
    selected && status === 'done'
      ? 'success'
      : selected && (status === 'partial' || status === 'interrupted')
        ? 'warning'
        : selected && status === 'error'
          ? 'error'
          : 'secondary';
  return (
    <AppPressable
      accessibilityRole="checkbox"
      accessibilityLabel={[
        name,
        label,
        hasResult ? `Current balance: ${balance.toLocaleString()} sat` : undefined,
      ]
        .filter(Boolean)
        .join(', ')}
      accessibilityHint={disabled ? undefined : 'Select this mint for recovery'}
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={onToggle}
      minHeight={appDimensions.touchTarget}
      px={appSpacing.page}
      py={appSpacing.gap}
      gap={appSpacing.compact}
      hoverStyle={disabled ? undefined : { bg: '$gray3' }}
      pressStyle={disabled ? undefined : { bg: '$gray3' }}
    >
      <XStack items="center" gap={appSpacing.compact}>
        <YStack
          aria-hidden
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <BUICheckboxVisual checked={selected} disabled={disabled} />
        </YStack>
        <YStack flex={1} minWidth={0} gap="$1">
          <AppText variant="label1">{name}</AppText>
          {hostname !== name && (
            <AppText variant="body3" tone="secondary">
              {hostname}
            </AppText>
          )}
        </YStack>
        {selected && status === 'done' ? (
          <CheckCircle2 size={22} color="$green10" aria-hidden />
        ) : selected && ['partial', 'error', 'interrupted'].includes(status) ? (
          <AlertCircle size={22} color={status === 'error' ? '$red10' : '$orange10'} aria-hidden />
        ) : null}
      </XStack>
      {selected && status !== 'ready' && (
        <XStack justify="space-between" items="center" gap="$2" flexWrap="wrap">
          <AppText variant="body2" tone={tone}>
            {label}
          </AppText>
          {hasResult && (
            <AppText variant="body3" tone="secondary">
              Current balance: {balance.toLocaleString()} sat
            </AppText>
          )}
        </XStack>
      )}
    </AppPressable>
  );
}
