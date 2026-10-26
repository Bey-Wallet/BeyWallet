import { Spinner } from '~/shared/ui/Spinner';
import { HeaderIconButton } from '~/shared/ui/HeaderIconButton';
import React, { useEffect, useRef } from 'react';
import { YStack, XStack, Text, View, H6 } from 'tamagui';
import { CheckCircle2, AlertCircle, Clock, ChevronRight, X } from '@tamagui/lucide-icons';
import * as Haptics from 'expo-haptics';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import AppBottomSheet, { AppBottomSheetRef } from '~/shared/ui/AppBottomSheet';
import { useWalletStore, type MintRestoreEntry } from '~/state/walletStore';

function MintProgressItem({
  entry,
  isActive,
  keysetProgress,
}: {
  entry: MintRestoreEntry;
  isActive: boolean;
  keysetProgress: any;
}) {
  const hostname = (() => {
    try {
      return new URL(entry.mintUrl).hostname;
    } catch {
      return entry.mintUrl;
    }
  })();

  const isDone = entry.status === 'done';
  const isError = entry.status === 'error';
  const isPending = entry.status === 'pending';

  const progressPercent =
    isActive && keysetProgress
      ? Math.round((keysetProgress.current / keysetProgress.total) * 100)
      : 0;

  return (
    <YStack
      p="$3.5"
      bg="$buttonDefaultSecondary"
      borderWidth={1}
      borderColor={isDone ? '$green10' : isError ? '$red10' : '$borderColor'}
      rounded="$6"
      gap="$2"
    >
      <XStack items="center" justify="space-between" gap="$3">
        {/* Left icon container + host name */}
        <XStack items="center" gap="$3" flex={1}>
          <View p="$2" bg="$gray3" rounded="$4" items="center" justify="center">
            {isActive && <Spinner size={18} color="$iconSecondary" />}
            {isDone && <CheckCircle2 size={18} color="$green10" />}
            {isError && <AlertCircle size={18} color="$red10" />}
            {isPending && <Clock size={18} color="$gray10" />}
          </View>
          <YStack flex={1} gap="$0.5">
            <Text fontWeight="600" fontSize="$4" color="$color" numberOfLines={1}>
              {hostname}
            </Text>
            {isDone && entry.restoredBalance > 0 && (
              <Text fontSize="$2" color="$green10" fontWeight="600">
                Restored +{entry.restoredBalance.toLocaleString()} sat
              </Text>
            )}
            {isDone && entry.restoredBalance === 0 && (
              <Text fontSize="$2" color="$gray10">
                0 sat found
              </Text>
            )}
            {isError && (
              <Text fontSize="$2" color="$red10" numberOfLines={1}>
                {entry.error || 'Sync failed'}
              </Text>
            )}
            {isPending && (
              <Text fontSize="$2" color="$gray10">
                Waiting to scan…
              </Text>
            )}
            {isActive && (
              <Text fontSize="$2" color="$gray10" fontWeight="600">
                Scanning keysets…
              </Text>
            )}
          </YStack>
        </XStack>

        {/* Right balance or progress badge */}
        {isActive && keysetProgress && (
          <View bg="$gray3" px="$2.5" py={4} rounded="$3">
            <Text fontSize="$2" fontWeight="600" color="$color">
              {progressPercent}%
            </Text>
          </View>
        )}
      </XStack>

      {/* Keyset sub-status and custom progress bar for active scanning mint */}
      {isActive && keysetProgress && (
        <YStack gap="$1.5" mt="$1" px="$3.5">
          <Text fontSize="$1" color="$gray10" fontWeight="600" opacity={0.85}>
            {keysetProgress.statusText}
          </Text>
          <View height={5} bg="$gray3" rounded="$3" overflow="hidden" width="100%">
            <View width={`${progressPercent}%`} height="100%" bg="$iconPrimary" rounded="$3" />
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

  const doneCount = mintRestoreStatuses.filter(
    (e) => e.status === 'done' || e.status === 'error',
  ).length;
  const totalCount = mintRestoreStatuses.length;

  const currentMintHost = (() => {
    if (!restoringMintUrl) return 'mint backups';
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
      {/* Keep live restore progress visible independently of dismissible Home prompts. */}
      <YStack
        width="100%"
        p="$3.5"
        rounded="$6"
        bg="$buttonDefaultSecondary"
        gap="$2.5"
        hoverStyle={{ bg: '$buttonDefaultSecondaryHover' }}
        pressStyle={{ bg: '$buttonDefaultSecondaryPress', opacity: 0.9, scale: 0.99 }}
        onPress={handlePress}
      >
        <XStack items="flex-start" justify="space-between">
          <XStack items="flex-start" gap="$2.5" flex={1}>
            <View p="$2" bg="$gray3" rounded="$3" items="center" justify="center">
              <Spinner size={20} color="$iconSecondary" />
            </View>
            <YStack flex={1} gap="$0.5">
              <H6 color="$color" fontWeight="600">
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
      <AppBottomSheet ref={sheetRef} snapPoints={['75%']} backgroundColor="$sheetBackground">
        <YStack p="$4" pt="$2" gap="$4" flex={1}>
          {/* Header */}
          <XStack items="center" justify="space-between" width="100%" pb="$2">
            <HeaderIconButton
              accessibilityLabel="Close"
              icon={X}
              onPress={() => sheetRef.current?.dismiss()}
            />
            <Text fontSize="$6" fontWeight="600" color="$color">
              Sync Progress
            </Text>
            {/* Placeholder keeping the title centered */}
            <View width={36} />
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
