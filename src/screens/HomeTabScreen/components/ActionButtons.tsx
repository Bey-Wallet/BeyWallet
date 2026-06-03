import React, { useRef, useCallback, useMemo } from "react";
import { Button, XStack, YStack, Text, ListItem } from "tamagui";
import { Landmark, ArrowRight } from "@tamagui/lucide-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import SwapIcon from "~/components/icons/Swap";
import ArrowDownIcon from "~/components/icons/ArrowDown";
import SendIcon from "~/components/icons/Send";
import AppBottomSheet, {
  AppBottomSheetRef,
} from "~/components/UI/AppBottomSheet";

// Static config — never recreated
const SHEET_ACTIONS = [
  {
    title: "Deposit or receive",
    subTitle: "Add funds to Mint.",
    path: "/mint",
  },
  {
    title: "Withdraw or send",
    subTitle: "Remove funds from Mint.",
    path: "/melt",
  },
] as const;

export default React.memo(function ActionButtons() {
  const router = useRouter();
  const sheetRef = useRef<AppBottomSheetRef>(null);

  const handleOptionPress = useCallback(
    (path: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      sheetRef.current?.dismiss();
      router.push(path as any);
    },
    [router],
  );

  const handleLandmark = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    sheetRef.current?.present();
  }, []);

  const handleSwap = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/swap");
  }, [router]);

  const handleReceive = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/receive");
  }, [router]);

  const handleSend = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push("/send");
  }, [router]);

  return (
    <>
      <XStack gap="$2" justify="space-between">
        <Button
          bg="$gray4"
          flex={1}
          height={60}
          size="$7"
          rounded="$5"
          icon={<Landmark size={28} />}
          onPress={handleLandmark}
        />
        <Button
          bg="$gray4"
          flex={1}
          height={60}
          size="$7"
          rounded="$5"
          icon={<SwapIcon size={28} />}
          onPress={handleSwap}
        />
        <Button
          bg="$gray4"
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

      <AppBottomSheet ref={sheetRef}>
        <YStack p="$4" gap="$2">
          <XStack justify="center">
            <Text
              fontSize="$6"
              color="$accent5"
              fontWeight="bold"
              mb="$2"
              px="$2"
            >
              Select action
            </Text>
          </XStack>
          {SHEET_ACTIONS.map((option, index) => (
            <ListItem
              key={index}
              hoverTheme
              pressTheme
              title={option.title}
              subTitle={option.subTitle}
              size="$6"
              iconAfter={<ArrowRight size={24} color="$color" />}
              onPress={() => handleOptionPress(option.path)}
              px="$4"
              rounded="$5"
              borderWidth={1}
              borderColor="$color3"
            />
          ))}
        </YStack>
      </AppBottomSheet>
    </>
  );
});
