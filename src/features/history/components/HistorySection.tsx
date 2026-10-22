import React from 'react';
import { Text, YStack } from 'tamagui';
import { appTypography } from '~/shared/theme/appearance';

export function HistorySection({ title }: { title: string }) {
  return (
    <YStack pt={20} pb={12}>
      <Text {...appTypography.label2} fontWeight="600" color="$color" accessibilityRole="header">
        {title}
      </Text>
    </YStack>
  );
}
