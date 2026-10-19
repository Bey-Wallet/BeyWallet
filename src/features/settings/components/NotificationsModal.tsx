import React, { forwardRef } from 'react';
import { YStack, XStack, H3, Circle, Text } from 'tamagui';
import { AppSwitch } from '~/shared/ui/AppSwitch';
import { Bell } from '@tamagui/lucide-icons';
import AppBottomSheet, { AppBottomSheetRef } from '~/shared/ui/AppBottomSheet';
import { useSettingsStore } from '~/state/settingsStore';
import * as Haptics from 'expo-haptics';

export const NotificationsModal = forwardRef<AppBottomSheetRef>((_, ref) => {
  const { notificationsEnabled, setNotificationsEnabled } = useSettingsStore();

  const handleToggle = (val: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setNotificationsEnabled(val);
  };

  return (
    <AppBottomSheet ref={ref} snapPoints={['35%']}>
      <YStack p="$4" gap="$4">
        <XStack items="center" gap="$3">
          <Circle p="$2" bg="$blue5">
            <Bell size={24} color="$blue10" />
          </Circle>
          <H3>Notifications</H3>
        </XStack>

        <YStack gap="$4" py="$2">
          <XStack justify="space-between" items="center" p="$3" bg="$gray2" rounded="$4">
            <YStack flex={1} pr="$4">
              <Text fontSize="$4" fontWeight="600">
                Push Notifications
              </Text>
              <Text fontSize="$3" color="$gray10" mt="$1">
                Receive alerts for incoming transactions and completed ecash claims.
              </Text>
            </YStack>
            <AppSwitch
              accessibilityLabel="Push Notifications"
              variant="branded"
              checked={notificationsEnabled}
              onCheckedChange={handleToggle}
            />
          </XStack>
        </YStack>
      </YStack>
    </AppBottomSheet>
  );
});

NotificationsModal.displayName = 'NotificationsModal';
