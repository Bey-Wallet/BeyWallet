import { Spinner } from '~/shared/ui/Spinner';
import { AppButton } from '~/shared/ui/AppButton';
import React, { useEffect, useRef } from 'react';
import { YStack, XStack, Text, H2, View, ScrollView, Circle } from 'tamagui';
import { Animated } from 'react-native';
import { CheckCircle2, AlertCircle, Clock, Zap } from '@tamagui/lucide-icons';
import * as Haptics from 'expo-haptics';
import type { MintRestoreEntry } from '~/state/walletStore';

interface RestoreProgressStepProps {
  entries: MintRestoreEntry[];
  isRestoring: boolean;
  totalRestoredSats: number;
  onDone: () => void;
}

// ── Mint row card ────────────────────────────────────────────────────────────

function MintRow({ entry }: { entry: MintRestoreEntry }) {
  const statusAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (entry.status === 'done' || entry.status === 'partial' || entry.status === 'error') {
      Animated.spring(statusAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();
    }
  }, [entry.status]);

  const hostname = (() => {
    try {
      return new URL(entry.mintUrl).hostname;
    } catch {
      return entry.mintUrl;
    }
  })();

  const isActive = entry.status === 'scanning';
  const isDone = entry.status === 'done';
  const isError = entry.status === 'error';
  const isPartial = entry.status === 'partial';
  const isPending = entry.status === 'pending';

  return (
    <Animated.View style={{ opacity: isPending ? 0.45 : 1 }}>
      <XStack
        bg={isActive ? '$blue2' : isDone ? '$green2' : isError ? '$red2' : '$gray2'}
        borderWidth={1}
        borderColor={isActive ? '$blue6' : isDone ? '$green6' : isError ? '$red6' : '$borderColor'}
        rounded="$4"
        px="$4"
        py="$3"
        items="center"
        gap="$3"
      >
        {/* Status icon */}
        <View width={28} items="center" justify="center">
          {isActive && <Spinner size={22} color="$blue9" />}
          {isDone && (
            <Animated.View style={{ transform: [{ scale: statusAnim }] }}>
              <CheckCircle2 size={22} color="$green9" />
            </Animated.View>
          )}
          {isError && (
            <Animated.View style={{ transform: [{ scale: statusAnim }] }}>
              <AlertCircle size={22} color="$red9" />
            </Animated.View>
          )}
          {isPending && <Clock size={20} color="$gray8" />}
          {isPartial && <AlertCircle size={22} color="$orange10" />}
        </View>

        {/* Mint info */}
        <YStack flex={1} gap="$0.5">
          <Text fontWeight="700" fontSize="$4" numberOfLines={1}>
            {hostname}
          </Text>
          <Text
            fontSize="$2"
            color={isActive ? '$blue10' : isDone ? '$green10' : isError ? '$red10' : '$gray9'}
          >
            {isActive
              ? entry.slow
                ? 'Still scanning. This mint is taking longer…'
                : 'Scanning for proofs…'
              : isPartial
                ? 'Some keysets need another scan. Recovered funds are saved.'
                : isDone
                  ? `Restored`
                  : isError
                    ? (entry.error ?? 'Failed')
                    : 'Waiting…'}
          </Text>
        </YStack>

        {/* Balance badge */}
        {(isDone || isPartial) && entry.restoredBalance > 0 && (
          <XStack bg="$green4" rounded="$3" px="$2" py="$1" items="center" gap="$1">
            <Text fontSize="$3" fontWeight="800" color="$green10">
              {entry.restoredBalance.toLocaleString()}
            </Text>
            <Text fontSize="$2" color="$green10">
              sat
            </Text>
          </XStack>
        )}
        {isDone && entry.restoredBalance === 0 && (
          <Text fontSize="$2" color="$gray9">
            0 sat
          </Text>
        )}
      </XStack>
    </Animated.View>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function RestoreProgressStep({
  entries,
  isRestoring,
  totalRestoredSats,
  onDone,
}: RestoreProgressStepProps) {
  const doneMints = entries.filter((e) => ['done', 'partial', 'error'].includes(e.status)).length;
  const totalMints = entries.length;
  const allDone = !isRestoring && entries.length > 0;
  const hasIssues = entries.some((entry) => entry.status === 'partial' || entry.status === 'error');

  // Haptic on completion
  useEffect(() => {
    if (allDone) {
      Haptics.notificationAsync(
        hasIssues
          ? Haptics.NotificationFeedbackType.Warning
          : Haptics.NotificationFeedbackType.Success,
      );
    }
  }, [allDone, hasIssues]);

  // Auto-scroll to currently scanning mint
  const scrollViewRef = useRef<any>(null);
  const activeIndex = entries.findIndex((e) => e.status === 'scanning');
  useEffect(() => {
    if (activeIndex !== -1 && scrollViewRef.current) {
      // Approximate height of a row + gap is ~75px
      scrollViewRef.current.scrollTo({ y: activeIndex * 75, animated: true });
    }
  }, [activeIndex]);

  // Pulse animation for the icon
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (isRestoring) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.12, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ]),
      ).start();
    } else {
      pulseAnim.stopAnimation();
      Animated.spring(pulseAnim, { toValue: 1, useNativeDriver: true }).start();
    }
  }, [isRestoring]);

  return (
    <YStack flex={1} bg="$background" px="$4" py="$6" gap="$5">
      {/* Header */}
      <YStack items="center" gap="$3" pt="$4">
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <Circle
            size={72}
            bg={allDone ? '$green3' : '$blue3'}
            borderWidth={2}
            borderColor={allDone ? '$green7' : '$blue7'}
            items="center"
            justify="center"
          >
            <Zap
              size={32}
              color={allDone ? '$green9' : '$blue9'}
              fill={allDone ? '$green9' : '$blue9'}
            />
          </Circle>
        </Animated.View>

        <YStack items="center" gap="$1">
          <H2 fontSize="$8" fontWeight="800" style={{ textAlign: 'center' }}>
            {allDone
              ? hasIssues
                ? 'Recovery needs review'
                : 'Restore Complete'
              : 'Restoring Wallet'}
          </H2>
          <Text color="$gray10" fontSize="$3" style={{ textAlign: 'center' }} px="$4">
            {allDone && hasIssues
              ? 'Recovered funds are saved. Retry incomplete scans from Settings → Recover funds.'
              : allDone
                ? 'Your proofs have been recovered. You can always restore balances from other mints later by adding them in the app.'
                : 'Scanning popular mints for your proofs. This may take a moment. You can also restore other mints later!'}
          </Text>
        </YStack>

        {/* Total balance counter */}
        {totalRestoredSats > 0 && (
          <XStack
            bg="$green3"
            borderWidth={1}
            borderColor="$green7"
            rounded="$5"
            px="$5"
            py="$2.5"
            items="center"
            gap="$2"
          >
            <Text fontSize="$7" fontWeight="900" color="$green10">
              {totalRestoredSats.toLocaleString()}
            </Text>
            <Text fontSize="$4" color="$green10" fontWeight="600">
              sat
            </Text>
          </XStack>
        )}

        {/* Progress text */}
        {isRestoring && totalMints > 0 && (
          <Text color="$gray9" fontSize="$3">
            {doneMints} of {totalMints} mint{totalMints !== 1 ? 's' : ''} scanned
          </Text>
        )}
      </YStack>

      {/* Mint cards */}
      <ScrollView ref={scrollViewRef} flex={1} showsVerticalScrollIndicator={false}>
        <YStack gap="$2.5">
          {entries.map((entry) => (
            <MintRow key={entry.mintUrl} entry={entry} />
          ))}
        </YStack>
      </ScrollView>

      {/* Done button */}
      <YStack gap="$2" width="100%">
        <AppButton
          variant="branded"
          emphasis="primary"
          size="large"
          loading={isRestoring}
          icon={allDone ? <CheckCircle2 size={22} /> : undefined}
          width="100%"
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onDone();
          }}
          disabled={isRestoring}
        >
          {isRestoring ? `Scanning ${doneMints}/${totalMints}…` : 'Go to Wallet'}
        </AppButton>

        {isRestoring && (
          <AppButton
            variant="default"
            emphasis="text-only"
            size="medium"
            width="100%"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onDone();
            }}
          >
            Skip and Go to Wallet
          </AppButton>
        )}
      </YStack>
    </YStack>
  );
}
