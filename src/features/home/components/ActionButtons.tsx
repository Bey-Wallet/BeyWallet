import { AppButton } from '~/shared/ui/AppButton';
import React, { useRef, useCallback } from 'react';
import { XStack } from 'tamagui';
import { Scan, ArrowLeftRight, Shuffle, RefreshCcw, ScanLine, Repeat } from '@tamagui/lucide-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import ArrowDownIcon from '~/shared/icons/ArrowDown';
import SendIcon from '~/shared/icons/Send';
import ActionSelectorSheet, { ActionSelectorSheetRef } from '~/shared/ui/ActionSelectorSheet';

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
      <XStack gap="$3" items="center" justify="space-between" width="100%">
        <AppButton
          variant="default"
          emphasis="secondary"
          size="large"
          iconOnly
          accessibilityLabel="Scan QR code"
          icon={<Scan size={28} strokeWidth={3} />}
          flex={1}
          onPress={handleScan}
        />
        <AppButton
          variant="default"
          emphasis="secondary"
          size="large"
          iconOnly
          accessibilityLabel="Swap"
          icon={<Repeat size={28} strokeWidth={2.5} />}
          flex={1}
          onPress={handleSwap}
        />
        <AppButton
          variant="default"
          emphasis="secondary"
          size="large"
          iconOnly
          accessibilityLabel="Receive"
          icon={<ArrowDownIcon size={32} />}
          flex={1}
          onPress={handleReceive}
        />
        <AppButton
          variant="branded"
          emphasis="primary"
          size="large"
          iconOnly
          accessibilityLabel="Send"
          icon={<SendIcon size={30} />}
          flex={1}
          onPress={handleSend}
        />
      </XStack>

      <ActionSelectorSheet ref={actionSheetRef} />
    </>
  );
});
