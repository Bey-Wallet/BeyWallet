import React, { forwardRef } from 'react';
import { YStack, XStack, H3, Circle } from 'tamagui';
import { Palette } from '@tamagui/lucide-icons';
import { ThemeSelector } from '~/components/ThemeSelector';
import AppBottomSheet, { AppBottomSheetRef } from '~/components/UI/AppBottomSheet';

export const ThemeModal = forwardRef<AppBottomSheetRef>((_, ref) => {
  return (
    <AppBottomSheet ref={ref}>
      <YStack p="$4" gap="$4">
        <XStack items="center" gap="$3">
          <Circle p="$2" bg="$purple5">
            <Palette size={24} color="$purple10" />
          </Circle>
          <H3>Appearance</H3>
        </XStack>

        <ThemeSelector />
      </YStack>
    </AppBottomSheet>
  );
});

ThemeModal.displayName = 'ThemeModal';
