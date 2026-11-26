import React from 'react';
import { YStack } from 'tamagui';
import WalletCard from './WalletCard';
import ActionButtons from './ActionButtons';
import { useSettingsStore } from '~/state/settingsStore';

/** Render the saved Home layout directly, without measuring a collapsed first frame. */
export function ExpandableWallet({ availableHeight }: { availableHeight: number }) {
  const expanded = useSettingsStore((state) => state.homeExpanded);

  return (
    <YStack
      testID="expandable-wallet"
      width="100%"
      height={expanded ? availableHeight : undefined}
      pb={expanded ? '$2' : undefined}
    >
      <YStack
        testID="balance-area"
        flex={expanded ? 1 : undefined}
        minHeight={expanded ? undefined : 224}
        width="100%"
        justify="center"
      >
        <WalletCard />
      </YStack>
      <ActionButtons />
    </YStack>
  );
}
