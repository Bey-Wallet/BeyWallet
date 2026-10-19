import React from 'react';
import { Stack, useRouter } from 'expo-router';
import { ChevronLeft } from '@tamagui/lucide-icons';
import { AppIconButton } from '~/shared/ui/AppIconButton';
import { ModalHeaderTitle } from '~/shared/ui/ModalHeaderTitle';

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
  return (
    <Stack.Screen
      options={{
        title,
        headerTitle: () => <ModalHeaderTitle>{title}</ModalHeaderTitle>,
        headerTitleAlign: 'center',
        headerBackVisible: false,
        headerLeft: () => (
          <AppIconButton
            variant="default"
            emphasis="tertiary"
            size="xsmall"
            shape="circular"
            accessibilityLabel="Back"
            disabled={disabled}
            icon={<ChevronLeft size={24} color="$color" />}
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
