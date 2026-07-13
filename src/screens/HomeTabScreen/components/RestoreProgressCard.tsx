import React, { useEffect, useRef } from "react";
import { YStack, XStack, Text, View, Button, H6 } from "tamagui";
import { CheckCircle2, AlertCircle, Clock, ChevronRight, X } from "@tamagui/lucide-icons";
import { Animated, Easing } from "react-native";
import * as Haptics from "expo-haptics";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import AppBottomSheet, { AppBottomSheetRef } from "~/components/UI/AppBottomSheet";
import { useWalletStore, type MintRestoreEntry } from "~/store/walletStore";

function SpinnerIcon({ size = 18, color = "$blue9" }) {
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [rotation]);

  const spin = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <Animated.View style={{ transform: [{ rotate: spin }] }}>
      <View
        width={size}
        height={size}
        borderRadius={999}
        borderWidth={2}
        borderColor={color}
        borderTopColor="transparent"
      />
    </Animated.View>
  );
}

function MintProgressItem({ entry, isActive, keysetProgress }: { entry: MintRestoreEntry; isActive: boolean; keysetProgress: any }) {
  const hostname = (() => {
    try {
      return new URL(entry.mintUrl).hostname;
    } catch {
      return entry.mintUrl;
    }
  })();

  const isDone = entry.status === "done";
  const isError = entry.status === "error";
  const isPending = entry.status === "pending";

  const progressPercent = isActive && keysetProgress
    ? Math.round((keysetProgress.current / keysetProgress.total) * 100)
    : 0;

  return (
    <YStack
      p="$3.5"
      bg={isActive ? "$blue2" : isDone ? "$green2" : isError ? "$red2" : "$gray4"}
      borderWidth={1}
      borderColor={isActive ? "$blue6" : isDone ? "$green6" : isError ? "$red6" : "transparent"}
      rounded="$6"
      gap="$2"
    >
      <XStack items="center" justify="space-between" gap="$3">
        {/* Left icon container + host name */}
        <XStack items="center" gap="$3" flex={1}>
          <View
            p="$2"
            bg={isActive ? "$blue4" : isDone ? "$green4" : isError ? "$red4" : "$gray5"}
            rounded="$4"
            items="center"
            justify="center"
          >
            {isActive && <SpinnerIcon />}
            {isDone && <CheckCircle2 size={18} color="$green10" />}
            {isError && <AlertCircle size={18} color="$red10" />}
            {isPending && <Clock size={18} color="$gray10" />}
          </View>
          <YStack flex={1} gap="$0.5">
            <Text fontWeight="700" fontSize="$4" color="$accent3" numberOfLines={1}>
              {hostname}
            </Text>
            {isDone && entry.restoredBalance > 0 && (
              <Text fontSize="$2" color="$green10" fontWeight="600">
                Restored +{entry.restoredBalance.toLocaleString()} sats
              </Text>
            )}
            {isDone && entry.restoredBalance === 0 && (
              <Text fontSize="$2" color="$gray9">
                0 sats found
              </Text>
            )}
            {isError && (
              <Text fontSize="$2" color="$red10" numberOfLines={1}>
                {entry.error || "Sync failed"}
              </Text>
            )}
            {isPending && (
              <Text fontSize="$2" color="$gray10">
                Waiting to scan…
              </Text>
            )}
            {isActive && (
              <Text fontSize="$2" color="$blue10" fontWeight="600">
                Scanning keysets…
              </Text>
            )}
          </YStack>
        </XStack>

        {/* Right balance or progress badge */}
        {isActive && keysetProgress && (
          <View bg="$blue4" px="$2.5" py={4} rounded="$3">
            <Text fontSize="$2" fontWeight="800" color="$blue10">
              {progressPercent}%
            </Text>
          </View>
        )}
      </XStack>

      {/* Keyset sub-status and custom progress bar for active scanning mint */}
      {isActive && keysetProgress && (
        <YStack gap="$1.5" mt="$1" px="$3.5">
          <Text fontSize="$1" color="$blue11" fontWeight="600" opacity={0.85}>
            {keysetProgress.statusText}
          </Text>
          <View height={5} bg="$blue4" rounded="$3" overflow="hidden" width="100%">
            <View
              width={`${progressPercent}%`}
              height="100%"
              bg="$blue9"
              rounded="$3"
            />
          </View>
        </YStack>
      )}
    </YStack>
  );
}

export default function RestoreProgressCard() {
  const sheetRef = useRef<AppBottomSheetRef>(null);
  
  const isRestoring = useWalletStore((s) => s.isRestoring);
  const mintRestoreStatuses = useWalletStore((s) => s.mintRestoreStatuses || []);
  const restoringMintUrl = useWalletStore((s) => s.restoringMintUrl);
  const restoringMintKeysetProgress = useWalletStore((s) => s.restoringMintKeysetProgress);

  const autoOpenedRef = useRef(false);

  useEffect(() => {
    if (isRestoring && mintRestoreStatuses.length > 0) {
      if (!autoOpenedRef.current) {
        autoOpenedRef.current = true;
        const timer = setTimeout(() => {
          sheetRef.current?.present();
        }, 600);
        return () => clearTimeout(timer);
      }
    } else {
      autoOpenedRef.current = false;
    }
  }, [isRestoring, mintRestoreStatuses.length]);

  if (!isRestoring || mintRestoreStatuses.length === 0) {
    return null;
  }

  const doneCount = mintRestoreStatuses.filter((e) => e.status === "done" || e.status === "error").length;
  const totalCount = mintRestoreStatuses.length;

  const currentMintHost = (() => {
    if (!restoringMintUrl) return "mint backups";
    try {
      return new URL(restoringMintUrl).hostname;
    } catch {
      return restoringMintUrl;
    }
  })();

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    sheetRef.current?.present();
  };

  return (
    <>
      {/* Clickable Card on Home Dashboard (Matches BackupWarningCard exactly) */}
      <YStack
        width="100%"
        p="$3.5"
        rounded="$5"
        bg="$color2"
        gap="$2.5"
        pressStyle={{ opacity: 0.9, scale: 0.99 }}
        onPress={handlePress}
      >
        <XStack items="flex-start" justify="space-between">
          <XStack items="flex-start" gap="$2.5" flex={1}>
            <View p="$2" bg="$blue5" rounded="$3" items="center" justify="center">
              <SpinnerIcon size={20} color="$blue10" />
            </View>
            <YStack flex={1} gap="$0.5">
              <H6 color="$color" fontWeight="800">
                Restoring Wallet Balances
              </H6>
              <Text fontSize="$2" overflow="hidden" color="$gray10" lineHeight={16}>
                Scanning {currentMintHost}… ({doneCount}/{totalCount} done)
              </Text>
            </YStack>
          </XStack>
          <View height={36} justify="center">
            <ChevronRight size={18} color="$gray10" />
          </View>
        </XStack>
      </YStack>

      {/* Details Bottom Sheet (Matches ActionSelectorSheet exactly) */}
      <AppBottomSheet ref={sheetRef} snapPoints={["75%"]} backgroundColor="$gray2">
        <YStack p="$4" pt="$2" gap="$4" flex={1}>
          {/* Header */}
          <XStack items="center" justify="space-between" width="100%" pb="$2">
            <Button
              circular
              size="$4"
              bg="$gray5"
              pressStyle={{ scale: 0.95, bg: '$gray5' }}
              icon={<X size={20} color="$color" strokeWidth={3} />}
              onPress={() => sheetRef.current?.dismiss()}
            />
            <Text fontSize="$6" fontWeight="800" color="$accent1">
              Sync Progress
            </Text>
            {/* Placeholder keeping the title centered */}
            <View width={44} height={44} />
          </XStack>

          {/* List of Mints scrollable container */}
          <BottomSheetScrollView showsVerticalScrollIndicator={false}>
            <YStack gap="$2.5" pb="$4">
              {mintRestoreStatuses.map((entry) => {
                const isActive = entry.mintUrl === restoringMintUrl;
                return (
                  <MintProgressItem
                    key={entry.mintUrl}
                    entry={entry}
                    isActive={isActive}
                    keysetProgress={isActive ? restoringMintKeysetProgress : null}
                  />
                );
              })}
            </YStack>
          </BottomSheetScrollView>
        </YStack>
      </AppBottomSheet>
    </>
  );
}
