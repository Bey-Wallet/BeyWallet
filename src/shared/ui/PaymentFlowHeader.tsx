import { HeaderIconButton } from '~/shared/ui/HeaderIconButton';
import React from 'react';
import { Stack, useRouter } from 'expo-router';
import { ArrowLeft, X } from '@tamagui/lucide-icons';
import { useScreenHeaderOptions } from '~/shared/ui/useScreenHeaderOptions';
import { Text, XStack } from 'tamagui';
import { useReceiptSheet } from '~/shared/ui/ReceiptSheetContext';

export function PaymentFlowHeader({
  title,
  onBack,
  disabled,
  headerRight,
  headerRightWidth = 48,
  navigationAction = 'back',
}: {
  title: string;
  onBack?: () => void;
  disabled?: boolean;
  headerRight?: () => React.ReactNode;
  headerRightWidth?: number;
  navigationAction?: 'back' | 'close';
}) {
  const router = useRouter();
  const headerOptions = useScreenHeaderOptions();
  const sheet = useReceiptSheet();
  if (sheet) {
    return (
      <XStack
        testID="receipt-header"
        items="center"
        minHeight={56}
        gap="$2"
        py={4}
        px={sheet.headerInset ?? 0}
      >
        <XStack
          testID="receipt-header-leading"
          width={headerRightWidth}
          minHeight={48}
          items="center"
          justify="flex-start"
        >
          <HeaderIconButton
            accessibilityLabel="Close receipt"
            icon={X}
            disabled={disabled || sheet.busy}
            onPress={sheet.close}
          />
        </XStack>
        <Text
          fontFamily="$body"
          fontSize={14}
          fontWeight="600"
          color="$color"
          flex={1}
          textAlign="center"
          accessibilityRole="header"
        >
          {title}
        </Text>
        <XStack
          testID="receipt-header-trailing"
          width={headerRightWidth}
          minHeight={48}
          items="center"
          justify="flex-end"
        >
          {headerRight?.()}
        </XStack>
      </XStack>
    );
  }
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
