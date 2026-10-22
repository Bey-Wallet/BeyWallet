import React from 'react';
import { Text, YStack } from 'tamagui';
import { appTypography } from '~/shared/theme/appearance';

export function HistorySection({ title }: { title: string }) {
  return (
    <YStack pt={20} pb={4}>
      <Text {...appTypography.label2} color="$gray10" accessibilityRole="header">
        {title}
      </Text>
    </YStack>
  );
}
