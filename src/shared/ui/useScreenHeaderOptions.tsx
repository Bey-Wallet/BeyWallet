import React from 'react';
import type { NativeStackHeaderProps } from '@react-navigation/native-stack';
import { useTheme } from 'tamagui';
import { AppScreenHeader } from './AppScreenHeader';

// Native stack calls this renderer directly; hooks belong to the mounted component.
function renderScreenHeader(props: NativeStackHeaderProps) {
  return <AppScreenHeader {...props} />;
}

export function useScreenHeaderOptions() {
  const theme = useTheme();
  return {
    header: renderScreenHeader,
    headerTitleAlign: 'center' as const,
    headerShadowVisible: false,
    headerBackVisible: false,
    headerStyle: { backgroundColor: theme.background.val },
    headerTintColor: theme.color.val,
  };
}
