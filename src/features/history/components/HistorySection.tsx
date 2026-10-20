import React from 'react';
import { Text, YStack } from 'tamagui';
import { useHistoryColors } from '../historyTheme';

export function HistorySection({ title }: { title: string }) {
  const colors = useHistoryColors();
  return (
    <YStack pt="$5" pb="$4">
      <Text
        accessibilityRole="header"
        fontFamily="$body"
        fontSize={22}
        lineHeight={28}
        fontWeight="600"
        color={colors.primary}
      >
        {title}
      </Text>
    </YStack>
  );
}
