import { AppPressable } from '~/shared/ui/AppPressable';
import React, { useRef, useCallback } from 'react';
import { Text, View, XStack, useTheme } from 'tamagui';
import { Scan, Repeat } from '@tamagui/lucide-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import ArrowDownIcon from '~/shared/icons/ArrowDown';
import SendIcon from '~/shared/icons/Send';
import ActionSelectorSheet, { ActionSelectorSheetRef } from '~/shared/ui/ActionSelectorSheet';

function HomeAction({
  label,
  accessibilityLabel = label,
  icon: Icon,
  branded = false,
  onPress,
}: {
  label: string;
  accessibilityLabel?: string;
  icon: React.ComponentType<{ size?: number; color?: string }>;
  branded?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const color = branded ? '$buttonBrandedPrimaryText' : '$buttonDefaultSecondaryText';
  const iconColor = String(
    (branded ? theme.buttonBrandedPrimaryText : theme.buttonDefaultSecondaryText)?.val ??
      theme.color?.val,
  );

  return (
    <AppPressable
      flex={1}
      minWidth={0}
      minHeight={80}
      rounded="$6"
      p={12}
      gap={12}
      items="flex-start"
      justify="space-between"
      bg={'$buttonDefaultSecondary'}
      hoverStyle={{
        bg: '$buttonDefaultSecondaryHover',
      }}
      pressStyle={{
        bg: '$buttonDefaultSecondaryPress',
        scale: 0.98,
      }}
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
    >
      <View aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Icon size={24} color={iconColor} />
      </View>
      <Text color={color} fontSize={14} lineHeight={20} fontWeight="600" flexShrink={1}>
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

  const handleSwap = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/swap');
  }, [router]);

  const handleReceive = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    actionSheetRef.current?.present('receive');
  }, []);

  const handleSend = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    actionSheetRef.current?.present('send');
  }, []);

  return (
    <>
      <XStack gap={8} items="stretch" width="100%">
        <HomeAction
          label="Scan"
          accessibilityLabel="Scan QR code"
          icon={Scan}
          onPress={handleScan}
        />
        {/* <HomeAction label="Swap" icon={Repeat} onPress={handleSwap} /> */}
        <HomeAction label="Receive" icon={ArrowDownIcon} onPress={handleReceive} />
        <HomeAction label="Send" icon={SendIcon} branded onPress={handleSend} />
      </XStack>

      <ActionSelectorSheet ref={actionSheetRef} />
    </>
  );
});
