import { AppPressable } from '~/shared/ui/AppPressable';
import React, { useRef, useCallback } from 'react';
import { Text, View, XStack, useTheme } from 'tamagui';
import { ArrowDown, ArrowRightLeft, ArrowUp, Scan } from '@tamagui/lucide-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import ActionSelectorSheet, { ActionSelectorSheetRef } from '~/shared/ui/ActionSelectorSheet';
import { appDimensions, appSpacing } from '~/shared/theme/appearance';

function HomeAction({
  label,
  accessibilityLabel = label,
  icon: Icon,
  iconSize = 22,
  iconStrokeWidth,
  onPress,
}: {
  label: string;
  accessibilityLabel?: string;
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  iconSize?: number;
  iconStrokeWidth?: number;
  onPress: () => void;
}) {
  const theme = useTheme();
  const iconColor = String(theme.color.val);

  return (
    <AppPressable
      flex={1}
      minWidth={0}
      minHeight={appDimensions.touchTarget}
      gap={appSpacing.compact}
      items="center"
      justify="flex-start"
      bg="transparent"
      hoverStyle={{ opacity: 0.85 }}
      pressStyle={{
        opacity: 0.7,
        scale: 0.98,
      }}
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
    >
      <View
        width="80%"
        aspectRatio={1}
        minWidth={appDimensions.touchTarget}
        minHeight={appDimensions.touchTarget}
        rounded={1000}
        bg="$buttonDefaultSecondary"
        items="center"
        justify="center"
        aria-hidden
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Icon
          size={iconSize}
          color={iconColor}
          {...(iconStrokeWidth !== undefined ? { strokeWidth: iconStrokeWidth } : {})}
        />
      </View>
      <Text color="$color" fontSize={13} lineHeight={18} fontWeight="600" textAlign="center">
        {label}
      </Text>
    </AppPressable>
  );
}

export default React.memo(function ActionButtons() {
  const router = useRouter();
  const actionSheetRef = useRef<ActionSelectorSheetRef>(null);

  const handleScan = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({
      pathname: '/(modals)/scanner',
      params: { returnTo: '/receive' },
    });
  }, [router]);

  const handleReceive = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    actionSheetRef.current?.present('receive');
  }, []);

  const handleSend = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    actionSheetRef.current?.present('send');
  }, []);
  const handleTransfer = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/(modals)/swap');
  }, [router]);

  return (
    <>
      <XStack gap={appSpacing.compact} items="stretch" width="100%">
        <HomeAction
          label="Scan"
          accessibilityLabel="Scan QR code"
          icon={Scan}
          iconSize={20}
          iconStrokeWidth={3}
          onPress={handleScan}
        />
        <HomeAction label="Transfer" icon={ArrowRightLeft} onPress={handleTransfer} />
        <HomeAction label="Receive" icon={ArrowDown} onPress={handleReceive} />
        <HomeAction label="Send" icon={ArrowUp} onPress={handleSend} />
      </XStack>

      <ActionSelectorSheet ref={actionSheetRef} />
    </>
  );
});
