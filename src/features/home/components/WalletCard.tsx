import React from 'react';
import { YStack } from 'tamagui';
import Balance from '~/features/home/components/Balance';

export default function WalletCard() {
  return (
    <YStack width={'100%'} gap="$2">
      <Balance />
    </YStack>
  );
}
