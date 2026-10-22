import { HeaderIconButton } from '~/shared/ui/HeaderIconButton';
import React from 'react';
import { Stack, useRouter } from 'expo-router';
import { ArrowLeft } from '@tamagui/lucide-icons';
import { useScreenHeaderOptions } from '~/shared/ui/useScreenHeaderOptions';

export function PaymentFlowHeader({
  title,
  onBack,
  disabled,
  headerRight,
}: {
  title: string;
  onBack?: () => void;
  disabled?: boolean;
  headerRight?: () => React.ReactNode;
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
            accessibilityLabel="Back"
            disabled={disabled}
            icon={<ArrowLeft size={24} color="$color" />}
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
