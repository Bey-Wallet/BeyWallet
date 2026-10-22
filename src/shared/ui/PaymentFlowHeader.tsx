import { HeaderIconButton } from '~/shared/ui/HeaderIconButton';
import React from 'react';
import { Stack, useRouter } from 'expo-router';
import { ArrowLeft, X } from '@tamagui/lucide-icons';
import { useScreenHeaderOptions } from '~/shared/ui/useScreenHeaderOptions';

export function PaymentFlowHeader({
  title,
  onBack,
  disabled,
  headerRight,
  navigationAction = 'back',
}: {
  title: string;
  onBack?: () => void;
  disabled?: boolean;
  headerRight?: () => React.ReactNode;
  navigationAction?: 'back' | 'close';
}) {
  const router = useRouter();
  const headerOptions = useScreenHeaderOptions();
  return (
    <Stack.Screen
      options={{
        title,
        ...headerOptions,
        headerLeft: () => (
          <HeaderIconButton
            accessibilityLabel={navigationAction === 'close' ? 'Close' : 'Back'}
            disabled={disabled}
            icon={navigationAction === 'close' ? X : ArrowLeft}
            onPress={
              onBack ||
              (() => {
                if (router.canGoBack()) router.back();
                else router.replace('/(tabs)');
              })
            }
          />
        ),
        ...(headerRight ? { headerRight } : {}),
      }}
    />
  );
}
