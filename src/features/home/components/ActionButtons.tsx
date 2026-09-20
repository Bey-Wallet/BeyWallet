import React, { useRef, useCallback } from 'react';
import { Button, XStack } from 'tamagui';
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
        <Button
          theme="gray"
          flex={1}
          height={58}
          rounded="$6"
          icon={<Scan size={28} strokeWidth={3} />}
          onPress={handleScan}
        />
        <Button
          theme="gray"
          flex={1}
          height={58}
          rounded="$6"
          icon={<Repeat size={28} strokeWidth={2.5} />}
          onPress={handleSwap}
        />
        <Button
          theme="gray"
          flex={1}
          height={58}
          rounded="$6"
          icon={<ArrowDownIcon size={32} />}
          onPress={handleReceive}
        />
        <Button
          theme="accent"
          bg="$color1"
          flex={1}
          height={58}
          rounded="$6"
          icon={<SendIcon size={30} />}
          onPress={handleSend}
        />
      </XStack>

      <ActionSelectorSheet ref={actionSheetRef} />
    </>
  );
});
