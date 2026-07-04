import React, { useRef, useCallback } from "react";
import { Button, XStack } from "tamagui";
import { Scan, ArrowLeftRight, Shuffle, RefreshCcw, ScanLine } from "@tamagui/lucide-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import ArrowDownIcon from "~/components/icons/ArrowDown";
import SendIcon from "~/components/icons/Send";
import ActionSelectorSheet, {
  ActionSelectorSheetRef,
} from "~/components/ActionSelectorSheet";

export default React.memo(function ActionButtons() {
  const router = useRouter();
  const actionSheetRef = useRef<ActionSelectorSheetRef>(null);

  const handleScan = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({
      pathname: "/(modals)/scanner",
      params: { returnTo: "/receive" },
    });
  }, [router]);

  const handleSwap = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/swap");
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
      <XStack gap="$2" justify="space-between">
        <Button
          theme="gray"

          flex={1}
          height={60}
          size="$7"
          rounded="$5"
          icon={<ScanLine size={28} strokeWidth={3} />}
          onPress={handleScan}
        />
        <Button
          theme="gray"

          flex={1}
          height={60}
          size="$7"
          rounded="$5"
          icon={<RefreshCcw size={28} strokeWidth={2.5} />}
          onPress={handleSwap}
        />
        <Button
          theme="gray"

          flex={1}
          height={60}
          size="$7"
          rounded="$5"
          icon={<ArrowDownIcon size={32} />}
          onPress={handleReceive}
        />
        <Button
          theme="accent"
          flex={1}
          height={60}
          size="$7"
          rounded="$5"
          icon={<SendIcon size={28} />}
          onPress={handleSend}
        />
      </XStack>

      <ActionSelectorSheet ref={actionSheetRef} />
    </>
  );
});

