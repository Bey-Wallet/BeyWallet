import React from 'react';
import { QrCode, RefreshCw } from '@tamagui/lucide-icons';
import { XStack, YStack } from 'tamagui';
import { appSpacing } from '~/shared/theme/appearance';
import { BUICard } from '~/shared/ui/BUI/BUICard';
import { MintText } from './MintUI';

export function MintQuickActions({
  onQr,
  onRestore,
  restoreDisabled = false,
  restoring = false,
}: {
  onQr: () => void;
  onRestore?: () => void;
  restoreDisabled?: boolean;
  restoring?: boolean;
}) {
  return (
    <XStack gap={appSpacing.compact}>
      <YStack flex={1}>
        <BUICard inset={0} onPress={onQr} label="Show mint QR code">
          <YStack
            minHeight={72}
            py={appSpacing.gap}
            gap={appSpacing.small}
            items="center"
            justify="center"
          >
            <QrCode size={22} color="$color" />
            <MintText kind="label2">QR</MintText>
          </YStack>
        </BUICard>
      </YStack>
      {onRestore && (
        <YStack flex={1}>
          <BUICard
            inset={0}
            onPress={onRestore}
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
