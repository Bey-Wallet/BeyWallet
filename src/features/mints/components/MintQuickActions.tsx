import React from 'react';
import { ArrowRightLeft, RefreshCw } from '~/shared/icons';
import { XStack, YStack } from 'tamagui';
import { appSpacing } from '~/shared/theme/appearance';
import { BUICard } from '~/shared/ui/BUI/BUICard';
import { MintText } from './MintUI';
import { hapticService } from '~/services/platform/hapticService';

export function MintQuickActions({
  onTransfer,
  transferDisabled = false,
  onRestore,
  restoreDisabled = false,
  restoring = false,
}: {
  onTransfer?: () => void;
  transferDisabled?: boolean;
  onRestore?: () => void;
  restoreDisabled?: boolean;
  restoring?: boolean;
}) {
  if (!onTransfer && !onRestore) return null;
  return (
    <XStack gap={appSpacing.compact}>
      {onTransfer && (
        <YStack flex={1}>
          <BUICard
            inset={0}
            onPress={() => {
              hapticService.selection();
              onTransfer();
            }}
            disabled={transferDisabled}
            label="Transfer funds"
          >
            <YStack
              minHeight={72}
              py={appSpacing.gap}
              gap={appSpacing.small}
              items="center"
              justify="center"
            >
              <ArrowRightLeft size={22} color="$color" />
              <MintText kind="label2">Transfer</MintText>
            </YStack>
          </BUICard>
        </YStack>
      )}
      {onRestore && (
        <YStack flex={1}>
          <BUICard
            inset={0}
            onPress={() => {
              hapticService.selection();
              onRestore();
            }}
            disabled={restoreDisabled || restoring}
            label="Restore funds"
          >
            <YStack
              minHeight={72}
              py={appSpacing.gap}
              gap={appSpacing.small}
              items="center"
              justify="center"
            >
              <RefreshCw size={22} color="$color" />
              <MintText kind="label2">{restoring ? 'Restoring…' : 'Restore'}</MintText>
            </YStack>
          </BUICard>
        </YStack>
      )}
    </XStack>
  );
}
