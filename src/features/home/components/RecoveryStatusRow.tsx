import React from 'react';
import { useRouter } from 'expo-router';
import { AlertCircle, ChevronRight } from '@tamagui/lucide-icons';
import { Text, XStack, YStack } from 'tamagui';
import { useRecoverySessionStore } from '~/state/recoverySessionStore';
import { AppPressable } from '~/shared/ui/AppPressable';
import { Spinner } from '~/shared/ui/Spinner';

export default function RecoveryStatusRow() {
  const router = useRouter();
  const session = useRecoverySessionStore((s) => s.session);
  if (!session?.needsReview) return null;
  const title =
    session.phase === 'recovering'
      ? 'Recovery in progress'
      : session.phase === 'interrupted'
        ? 'Recovery interrupted'
        : 'Recovery needs review';
  return (
    <AppPressable
      accessibilityRole="button"
      accessibilityLabel={title}
      minHeight={48}
      p="$3.5"
      rounded="$6"
      bg="$buttonDefaultSecondary"
      hoverStyle={{ bg: '$buttonDefaultSecondaryHover' }}
      pressStyle={{ bg: '$buttonDefaultSecondaryPress' }}
      onPress={() => router.push('/(tabs)/settings/recover-funds')}
    >
      <XStack items="center" gap="$3">
        {session.phase === 'recovering' ? (
          <Spinner size={20} color="$iconSecondary" />
        ) : (
          <AlertCircle size={20} color="$iconSecondary" />
        )}
        <YStack flex={1} gap="$1">
          <Text fontSize={14} color="$color" fontWeight="600">
            {title}
          </Text>
          <Text fontSize={12} color="$gray10">
            Review selected mints and scan results.
          </Text>
        </YStack>
        <ChevronRight size={20} color="$gray10" />
      </XStack>
    </AppPressable>
  );
}
