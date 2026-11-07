import { BUIActionButton } from '~/shared/ui/BUI/BUIButton';
import React, { useRef, useCallback } from 'react';
import { XStack } from 'tamagui';
import { ArrowDown, ArrowRightLeft, ArrowUp, Scan } from '@tamagui/lucide-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import ActionSelectorSheet, { ActionSelectorSheetRef } from '~/shared/ui/ActionSelectorSheet';
import { appSpacing } from '~/shared/theme/appearance';

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
  return (
    <BUIActionButton
      flex={1}
      title={label}
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
    >
      <Icon
        size={iconSize}
        color="$buttonDefaultSecondaryText"
        {...(iconStrokeWidth !== undefined ? { strokeWidth: iconStrokeWidth } : {})}
      />
    </BUIActionButton>
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
