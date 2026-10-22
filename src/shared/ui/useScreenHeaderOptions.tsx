import React from 'react';
import { useTheme } from 'tamagui';
import { ModalHeaderTitle } from '~/shared/ui/ModalHeaderTitle';

export function useScreenHeaderOptions() {
  const theme = useTheme();
  return {
    headerTitleAlign: 'center' as const,
    headerShadowVisible: false,
    headerBackVisible: false,
    headerStyle: { backgroundColor: theme.background.val },
    headerTintColor: theme.color.val,
    headerTitle: ({ children }: { children: string }) => (
      <ModalHeaderTitle>{children}</ModalHeaderTitle>
    ),
  };
}
