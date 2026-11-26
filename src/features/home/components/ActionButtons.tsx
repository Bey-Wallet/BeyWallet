import { AppPressable } from '~/shared/ui/AppPressable';
import React, { useRef, useCallback } from 'react';
import { Text, XStack, YStack } from 'tamagui';
import { ArrowDown, ArrowRightLeft, Scan, Send, type AppIconProps } from '~/shared/icons';
import { useRouter } from 'expo-router';
import ActionSelectorSheet, { ActionSelectorSheetRef } from '~/shared/ui/ActionSelectorSheet';
import { appDimensions, appIconSizes, appSpacing, appTypography } from '~/shared/theme/appearance';
import { hapticService } from '~/services/platform/hapticService';

function HomeAction({
  label,
  accessibilityLabel = label,
  icon: Icon,
  onPress,
}: {
  label: string;
  accessibilityLabel?: string;
  icon: React.ComponentType<AppIconProps>;
  onPress: () => void;
}) {
  return (
    <AppPressable
      flex={1}
      minWidth={appDimensions.touchTarget}
      minHeight={appDimensions.touchTarget}
      items="center"
      justify="center"
      gap={appSpacing.compact}
      accessibilityLabel={accessibilityLabel}
      onPress={() => {
        hapticService.selection();
        onPress();
      }}
    >
      <YStack height={appIconSizes.navigation} justify="center" aria-hidden>
        <Icon size={appIconSizes.navigation} color="$color" strokeWidth={3} weight="bold" />
      </YStack>
      <Text {...appTypography.body3} fontWeight="600" color="$gray10">
        {label}
      </Text>
    </AppPressable>
  );
}

export default React.memo(function ActionButtons() {
  const router = useRouter();
  const actionSheetRef = useRef<ActionSelectorSheetRef>(null);

  const handleScan = useCallback(() => {
    router.push({
      pathname: '/(modals)/scanner',
      params: { returnTo: '/receive' },
    });
  }, [router]);

  const handleReceive = useCallback(() => {
    actionSheetRef.current?.present('receive');
  }, []);

  const handleSend = useCallback(() => {
    actionSheetRef.current?.present('send');
  }, []);
  const handleTransfer = useCallback(() => {
    router.push('/(modals)/swap');
  }, [router]);

  return (
    <>
      <XStack gap={appSpacing.compact} items="stretch" width="100%">
        <HomeAction
          label="Scan"
          accessibilityLabel="Scan QR code"
          icon={Scan}
          onPress={handleScan}
        />
        <HomeAction label="Transfer" icon={ArrowRightLeft} onPress={handleTransfer} />
        <HomeAction label="Receive" icon={ArrowDown} onPress={handleReceive} />
        <HomeAction label="Send" icon={Send} onPress={handleSend} />
      </XStack>

      <ActionSelectorSheet ref={actionSheetRef} />
    </>
  );
});
